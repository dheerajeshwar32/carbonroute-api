import { randomUUID } from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Logger } from 'pino';

import type { AppConfig } from './config';
import { AppError, SLAViolationError, ValidationError } from './errors';
import type { RegionSnapshot } from './regions';
import { RoutingDecision, selectOptimalRegion } from './scheduler';
import type { TelemetrySource } from './telemetry';
import { cacheKey, ResponseCache } from './cache';
import type { InferenceProvider } from './inference';
import { buildInferenceSchema, formatIssues } from './validation';
import { openApiSpec } from './openapi';

export interface AppDeps {
    config: AppConfig;
    telemetry: TelemetrySource;
    cache: ResponseCache;
    inference: InferenceProvider;
    logger: Logger;
}

declare module 'express-serve-static-core' {
    interface Request {
        id: string;
        log: Logger;
    }
}

const round = (n: number, digits = 4) => Number(n.toFixed(digits));

/** grams CO2e = Wh * (g/kWh) / 1000 */
const gramsFor = (energyWh: number, intensity: number) => round((energyWh * intensity) / 1000, 5);

function regionView(r: RegionSnapshot) {
    return {
        id: r.id,
        location: r.location,
        grid_zone: r.gridZone,
        latency_ms: r.latencyMs,
        latency_source: r.latencySource,
        latency_updated_at: r.latencyUpdatedAt,
        carbon_intensity: r.carbonIntensity,
        carbon_source: r.carbonSource,
        carbon_updated_at: r.carbonUpdatedAt,
        cost_per_1k_tokens: r.costPer1kTokens,
    };
}

function routingView(decision: RoutingDecision, executedRegion: string | null) {
    const winner = executedRegion ?? decision.selected.region.id;
    return {
        policy: {
            max_latency_ms: decision.policy.maxLatencyMs,
            carbon_weight: round(decision.policy.carbonWeight),
            cost_weight: round(decision.policy.costWeight),
            latency_weight: round(decision.policy.latencyWeight),
        },
        baseline_region: decision.baseline.id,
        candidates: [
            ...decision.ranked.map(s => ({
                ...regionView(s.region),
                normalized_carbon: round(s.normalizedCarbon),
                normalized_cost: round(s.normalizedCost),
                normalized_latency: round(s.normalizedLatency),
                score: round(s.score),
                rank: s.rank,
                status: s.region.id === winner ? 'selected' : 'eligible',
            })),
            ...decision.excluded.map(e => ({
                ...regionView(e.region),
                normalized_carbon: null,
                normalized_cost: null,
                normalized_latency: null,
                score: null,
                rank: null,
                status: 'excluded',
                excluded_reason: e.reason,
            })),
        ],
    };
}

function impactView(baseline: RegionSnapshot, actualIntensity: number, energyWh: number) {
    const savedPct = baseline.carbonIntensity > 0
        ? ((baseline.carbonIntensity - actualIntensity) / baseline.carbonIntensity) * 100
        : 0;
    return {
        baseline_region: baseline.id,
        baseline_location: baseline.location,
        baseline_carbon_intensity: baseline.carbonIntensity,
        carbon_saved_pct: round(savedPct, 1),
        estimated_emissions_g: gramsFor(energyWh, actualIntensity),
        estimated_emissions_avoided_g: gramsFor(energyWh, baseline.carbonIntensity - actualIntensity),
        energy_per_request_wh: energyWh,
    };
}

export function createApp({ config, telemetry, cache, inference, logger }: AppDeps) {
    const app = express();
    const startedAt = Date.now();
    const schema = buildInferenceSchema({
        maxPromptChars: config.MAX_PROMPT_CHARS,
        allowedModels: config.ALLOWED_MODELS,
    });
    const executionLabel = inference.mode === 'regional' ? 'regional' : 'simulated';

    app.set('trust proxy', config.TRUST_PROXY);
    app.use(helmet());

    // Dynamic CORS with support for Vercel preview environments
    const vercelPreviewRegex = /^https:\/\/carbon-route.*\.vercel\.app$/;
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (config.CORS_ORIGINS.includes(origin) || vercelPreviewRegex.test(origin)) {
                return callback(null, true);
            }
            if (config.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
            return callback(null, false);
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
        maxAge: 600,
    }));

    app.use(express.json({ limit: '16kb' }));

    // Request ID & lifecycle logging
    app.use((req, res, next) => {
        const incoming = req.get('x-request-id');
        req.id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
        req.log = logger.child({ reqId: req.id });
        res.setHeader('x-request-id', req.id);
        const start = performance.now();
        res.on('finish', () => {
            req.log.info({
                method: req.method,
                path: req.path,
                status: res.statusCode,
                ms: Math.round(performance.now() - start),
            }, 'request');
        });
        next();
    });

    const limiter = (limit: number) => rateLimit({
        windowMs: config.RATE_LIMIT_WINDOW_MS,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (req, res) => {
            const code = 'rate_limited';
            const message = 'Too many requests — please slow down and try again shortly.';
            res.status(429).json({
                success: false,
                status: 'error',
                code,
                message,
                error: {
                    code,
                    message,
                    details: null,
                },
                request_id: req.id,
                meta: {
                    request_id: req.id,
                    timestamp: new Date().toISOString(),
                    version: 'v1',
                },
            });
        },
    });

    // --- Health ---------------------------------------------------------------
    app.get('/health', (_req, res) => {
        res.json({
            success: true,
            status: 'ok',
            meta: {
                request_id: _req.id,
                timestamp: new Date().toISOString(),
                version: 'v1',
            },
            uptime_s: Math.round((Date.now() - startedAt) / 1000),
            execution_mode: executionLabel,
            cache: cache.status(),
            telemetry: telemetry.status(),
        });
    });

    // --- OpenAPI 3.1 Spec -----------------------------------------------------
    app.get('/api/v1/openapi.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.json(openApiSpec);
    });

    // --- Live region telemetry -------------------------------------------------
    app.get('/api/v1/regions', limiter(config.RATE_LIMIT_MAX * 6), (req, res) => {
        res.json({
            success: true,
            status: 'success',
            meta: {
                request_id: req.id,
                timestamp: new Date().toISOString(),
                version: 'v1',
            },
            execution_mode: executionLabel,
            default_model: config.DEFAULT_MODEL,
            allowed_models: config.ALLOWED_MODELS,
            energy_per_request_wh: config.ENERGY_PER_REQUEST_WH,
            telemetry: telemetry.status(),
            regions: telemetry.snapshot().map(regionView),
        });
    });

    // --- Inference ---------------------------------------------------------------
    app.post('/api/v1/inference', limiter(config.RATE_LIMIT_MAX), async (req: Request, res: Response) => {
        const startTime = performance.now();

        // Safe Client Disconnect: bind AbortController to response lifecycle
        const abortController = new AbortController();
        res.on('close', () => {
            if (!res.writableEnded) {
                req.log.info('Client connection closed prior to completion; aborting upstream inference');
                abortController.abort();
            }
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            throw new ValidationError('Invalid request payload.', formatIssues(parsed.error));
        }
        const { prompt, sla } = parsed.data;
        const model = parsed.data.model ?? config.DEFAULT_MODEL;

        // Route first
        let decision: RoutingDecision | null = null;
        let slaError: SLAViolationError | null = null;
        try {
            decision = selectOptimalRegion(telemetry.snapshot(), sla);
        } catch (err) {
            if (err instanceof SLAViolationError) slaError = err;
            else if (err instanceof RangeError) throw new ValidationError(err.message);
            else throw err;
        }

        const key = cacheKey(model, prompt);
        const cached = await cache.get(key);

        if (cached) {
            req.log.info({ model, promptChars: prompt.length }, 'cache hit');
            const regions = telemetry.snapshot();
            const baseline = decision?.baseline
                ?? regions.reduce((a, b) => (b.latencyMs < a.latencyMs ? b : a));

            res.json({
                success: true,
                status: 'success',
                meta: {
                    request_id: req.id,
                    timestamp: new Date().toISOString(),
                    version: 'v1',
                },
                request_id: req.id,
                cache_hit: true,
                execution_mode: 'cache',
                model,
                routed_to: 'cache',
                location: 'Edge cache (Redis)',
                cached_from: { region: cached.region, location: cached.location, cached_at: cached.cachedAt },
                telemetry: {
                    latency_ms: Math.round(performance.now() - startTime),
                    network_rtt_ms: 0,
                    latency_source: 'measured',
                    cost_per_1k_tokens: 0,
                    live_carbon_intensity: 0,
                    carbon_intensity: 0,
                    carbon_source: 'live',
                    carbon_updated_at: null,
                },
                impact: impactView(baseline, 0, config.ENERGY_PER_REQUEST_WH),
                routing: decision ? routingView(decision, null) : null,
                usage: null,
                data: cached.text,
            });
            return;
        }

        if (slaError || !decision) throw slaError ?? new SLAViolationError('No routing decision available.');

        // Pass client cancellation signal down to inference provider
        const result = await inference.generate(
            model,
            prompt,
            decision.ranked.map(r => r.region.id),
            abortController.signal
        );

        // Failover support: winner region resolution
        const executed = (result.executedRegion
            && decision.ranked.find(r => r.region.id === result.executedRegion)?.region)
            || decision.selected.region;

        void cache.set(key, {
            text: result.text,
            model,
            region: executed.id,
            location: executed.location,
            cachedAt: new Date().toISOString(),
        });

        req.log.info({ model, region: executed.id, mode: executionLabel, promptChars: prompt.length }, 'routed');

        res.json({
            success: true,
            status: 'success',
            meta: {
                request_id: req.id,
                timestamp: new Date().toISOString(),
                version: 'v1',
            },
            request_id: req.id,
            cache_hit: false,
            execution_mode: executionLabel,
            model,
            routed_to: executed.id,
            location: executed.location,
            telemetry: {
                latency_ms: Math.round(performance.now() - startTime),
                network_rtt_ms: executed.latencyMs,
                latency_source: executed.latencySource,
                cost_per_1k_tokens: executed.costPer1kTokens,
                live_carbon_intensity: executed.carbonIntensity,
                carbon_intensity: executed.carbonIntensity,
                carbon_source: executed.carbonSource,
                carbon_updated_at: executed.carbonUpdatedAt,
            },
            impact: impactView(decision.baseline, executed.carbonIntensity, config.ENERGY_PER_REQUEST_WH),
            routing: { ...routingView(decision, executed.id), failover: result.failover },
            usage: {
                prompt_tokens: result.usage.promptTokens,
                output_tokens: result.usage.outputTokens,
            },
            data: result.text,
        });
    });

    // --- 404 + error handling ---------------------------------------------------
    app.use((req, res) => {
        const code = 'not_found';
        const message = `No route for ${req.method} ${req.path}`;
        res.status(404).json({
            success: false,
            status: 'error',
            code,
            message,
            error: {
                code,
                message,
                details: null,
            },
            request_id: req.id,
            meta: {
                request_id: req.id,
                timestamp: new Date().toISOString(),
                version: 'v1',
            },
        });
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
        const requestId = req.id;
        const meta = {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            version: 'v1',
        };

        const bodyErr = err as { type?: string };
        if (bodyErr?.type === 'entity.parse.failed') {
            const code = 'invalid_json';
            const message = 'Request body is not valid JSON.';
            res.status(400).json({
                success: false,
                status: 'error',
                code,
                message,
                error: { code, message, details: null },
                request_id: requestId,
                meta,
            });
            return;
        }

        if (bodyErr?.type === 'entity.too.large') {
            const code = 'payload_too_large';
            const message = 'Request body is too large.';
            res.status(413).json({
                success: false,
                status: 'error',
                code,
                message,
                error: { code, message, details: null },
                request_id: requestId,
                meta,
            });
            return;
        }

        if (err instanceof AppError) {
            (req.log ?? logger)[err.status >= 500 ? 'error' : 'info']({ code: err.code, details: err.details }, err.message);
            res.status(err.status).json({
                success: false,
                status: 'error',
                code: err.code,
                message: err.message,
                error: {
                    code: err.code,
                    message: err.message,
                    details: err.details ?? null,
                },
                details: err.details ?? null,
                request_id: requestId,
                meta,
            });
            return;
        }

        (req.log ?? logger).error({ err }, 'unhandled error');
        const code = 'internal_error';
        const message = 'Internal server error.';
        res.status(500).json({
            success: false,
            status: 'error',
            code,
            message,
            error: { code, message, details: null },
            request_id: requestId,
            meta,
        });
    });

    return app;
}
