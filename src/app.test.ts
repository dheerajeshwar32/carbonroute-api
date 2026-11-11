import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import { createApp } from './app';
import { loadConfig } from './config';
import { MemoryCache } from './cache';
import { getTelemetrySource } from './telemetry';
import { InferenceProvider, InferenceResult } from './inference';

describe('API Gateway Endpoints', () => {
    const config = loadConfig({
        NODE_ENV: 'test',
        PORT: '3000',
        GEMINI_API_KEY: 'test-api-key',
    });
    const logger = pino({ level: 'silent' });
    const cache = new MemoryCache();
    const telemetry = getTelemetrySource();

    const mockInference: InferenceProvider = {
        mode: 'global',
        generate: vi.fn(async (_model: string, _prompt: string, _candidates: string[]): Promise<InferenceResult> => ({
            text: 'Test inference completion text.',
            executedRegion: 'europe-north1',
            failover: [],
            usage: { promptTokens: 12, outputTokens: 8 },
        })),
    };

    const app = createApp({
        config,
        telemetry,
        cache,
        inference: mockInference,
        logger,
    });

    it('GET /health returns unified envelope with uptime and dependency statuses', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('ok');
        expect(res.body.meta).toBeDefined();
        expect(res.body.meta.request_id).toBeDefined();
        expect(res.body.meta.version).toBe('v1');
        expect(res.body.cache).toBe('up');
        expect(res.body.telemetry.live).toBe(true);
        expect(res.body.telemetry.region_count).toBe(5);
    });

    it('GET /api/v1/openapi.json returns valid OpenAPI 3.1 specification', async () => {
        const res = await request(app).get('/api/v1/openapi.json');
        expect(res.status).toBe(200);
        expect(res.body.openapi).toBe('3.1.0');
        expect(res.body.info.title).toContain('CarbonRoute');
        expect(res.body.paths['/api/v1/inference']).toBeDefined();
        expect(res.body.paths['/api/v1/regions']).toBeDefined();
        expect(res.body.paths['/health']).toBeDefined();
    });

    it('GET /api/v1/regions verifies synchronous cold-boot hydration with complete metadata', async () => {
        const res = await request(app).get('/api/v1/regions');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('success');
        expect(res.body.regions).toHaveLength(5);

        for (const region of res.body.regions) {
            expect(region.id).toBeDefined();
            expect(region.location).toBeDefined();
            expect(['measured', 'fallback', 'static_baseline']).toContain(region.latency_source);
            expect(['live', 'fallback', 'static_baseline']).toContain(region.carbon_source);
            expect(region.latency_updated_at).toBeDefined();
            expect(region.carbon_updated_at).toBeDefined();
            expect(region.carbon_intensity).toBeGreaterThan(0);
            expect(region.latency_ms).toBeGreaterThan(0);
        }
    });

    it('POST /api/v1/inference returns unified success envelope and normalizes simplex weights', async () => {
        const payload = {
            prompt: 'Test green routing verification prompt',
            model: 'gemini-3.8-flash',
            sla: {
                max_latency_ms: 250,
                carbon_priority_weight: 0.8,
                cost_priority_weight: 0.1,
                latency_priority_weight: 0.1,
            },
        };

        const res = await request(app).post('/api/v1/inference').send(payload);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('success');
        expect(res.body.meta.request_id).toBeDefined();
        expect(res.body.data).toBe('Test inference completion text.');
        expect(res.body.telemetry).toBeDefined();
        expect(res.body.impact).toBeDefined();
        expect(res.body.routing).toBeDefined();
        expect(res.body.routing.policy.carbon_weight).toBe(0.8);
        expect(res.body.routing.policy.cost_weight).toBe(0.1);
        expect(res.body.routing.policy.latency_weight).toBe(0.1);
        expect(res.body.cache_hit).toBe(false);
    });

    it('POST /api/v1/inference returns cache hit on subsequent identical prompt', async () => {
        const payload = {
            prompt: 'Test cache hit prompt',
            model: 'gemini-3.8-flash',
            sla: { max_latency_ms: 300 },
        };

        const res1 = await request(app).post('/api/v1/inference').send(payload);
        expect(res1.status).toBe(200);
        expect(res1.body.cache_hit).toBe(false);

        const res2 = await request(app).post('/api/v1/inference').send(payload);
        expect(res2.status).toBe(200);
        expect(res2.body.cache_hit).toBe(true);
        expect(res2.body.routed_to).toBe('cache');
        expect(res2.body.telemetry.live_carbon_intensity).toBe(0);
    });

    it('POST /api/v1/inference rejects zero-weight degeneracy with 400 validation error', async () => {
        const payload = {
            prompt: 'Test zero weight payload',
            sla: {
                max_latency_ms: 200,
                carbon_priority_weight: 0,
                cost_priority_weight: 0,
                latency_priority_weight: 0,
            },
        };

        const res = await request(app).post('/api/v1/inference').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('invalid_request');
        expect(res.body.details).toBeInstanceOf(Array);
        expect(res.body.details[0].message).toContain('At least one priority weight must be greater than zero');
    });

    it('POST /api/v1/inference returns 400 with structured validation issues for bad payload', async () => {
        const payload = {
            prompt: '', // empty prompt
            sla: { max_latency_ms: -50 },
        };

        const res = await request(app).post('/api/v1/inference').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.status).toBe('error');
        expect(res.body.code).toBe('invalid_request');
        expect(res.body.error.code).toBe('invalid_request');
        expect(res.body.details).toBeInstanceOf(Array);
        expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('POST /api/v1/inference returns 422 when latency SLA is impossible', async () => {
        const payload = {
            prompt: 'Strict impossible latency test',
            sla: { max_latency_ms: 10 }, // No region has latency <= 10ms
        };

        const res = await request(app).post('/api/v1/inference').send(payload);
        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('sla_unsatisfiable');
        expect(res.body.error.message).toContain('No available region satisfies the latency SLA constraint');
    });

    it('404 catch-all returns unified JSON error envelope', async () => {
        const res = await request(app).get('/api/v1/nonexistent-route');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.status).toBe('error');
        expect(res.body.code).toBe('not_found');
        expect(res.body.error.code).toBe('not_found');
        expect(res.body.meta.request_id).toBeDefined();
    });
});
