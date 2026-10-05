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
        },
        baseline_region: decision.baseline.id,
        candidates: [
            ...decision.ranked.map(s => ({
                ...regionView(s.region),
                normalized_carbon: round(s.normalizedCarbon),
                normalized_cost: round(s.normalizedCost),
                score: round(s.score),
                rank: s.rank,
                status: s.region.id === winner ? 'selected' : 'eligible',
            })),
            ...decision.excluded.map(e => ({
                ...regionView(e.region),
                normalized_carbon: null,
                normalized_cost: null,
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
    app.use(cors({ origin: config.CORS_ORIGINS, methods: ['GET', 'POST'], maxAge: 600 }));
    app.use(express.json({ limit: '16kb' }));

    // Request id + access log (prompts are never logged — only their length).
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
            res.status(429).json({
                status: 'error',
                code: 'rate_limited',
                error: 'Too many requests — please slow down and try again shortly.',
                request_id: req.id,
            });
        },
    });

    // --- Health ---------------------------------------------------------------
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            uptime_s: Math.round((Date.now() - startedAt) / 1000),
            execution_mode: executionLabel,
            cache: cache.status(),
            telemetry: telemetry.status(),
        });
    });

    // --- Live region telemetry -------------------------------------------------
    app.get('/api/v1/regions', limiter(config.RATE_LIMIT_MAX * 6), (_req, res) => {
        res.json({
            status: 'success',
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
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            throw new ValidationError('Invalid request payload.', formatIssues(parsed.error));
        }
        const { prompt, sla } = parsed.data;
        const model = parsed.data.model ?? config.DEFAULT_MODEL;

        // Route first. A cache hit can satisfy any latency SLA, so an SLA failure
        // is only raised if we actually need cloud compute.
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
                status: 'success',
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

        const result = await inference.generate(model, prompt, decision.ranked.map(r => r.region.id));

        // In regional mode failover may have moved execution to a lower-ranked region.
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
            status: 'success',
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
        res.status(404).json({ status: 'error', code: 'not_found', error: `No route for ${req.method} ${req.path}`, request_id: req.id });
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
        const requestId = req.id;
        const bodyErr = err as { type?: string };

        if (bodyErr?.type === 'entity.parse.failed') {
            res.status(400).json({ status: 'error', code: 'invalid_json', error: 'Request body is not valid JSON.', request_id: requestId });
            return;
        }
        if (bodyErr?.type === 'entity.too.large') {
            res.status(413).json({ status: 'error', code: 'payload_too_large', error: 'Request body is too large.', request_id: requestId });
            return;
        }
        if (err instanceof AppError) {
            (req.log ?? logger)[err.status >= 500 ? 'error' : 'info']({ code: err.code, details: err.details }, err.message);
            res.status(err.status).json({ status: 'error', code: err.code, error: err.message, details: err.details, request_id: requestId });
            return;
        }

        (req.log ?? logger).error({ err }, 'unhandled error');
        res.status(500).json({ status: 'error', code: 'internal_error', error: 'Internal server error.', request_id: requestId });
    });

    return app;
}
