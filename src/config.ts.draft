import { z } from 'zod';

const csv = (value: string) =>
    value.split(',').map(s => s.trim()).filter(Boolean);

const bool = z
    .enum(['true', 'false', '1', '0'])
    .transform(v => v === 'true' || v === '1');

/**
 * Every environment variable the service reads, validated once at boot.
 * Invalid configuration fails fast with a readable error instead of
 * surfacing as a confusing runtime failure later.
 */
const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    // --- Inference ---------------------------------------------------------
    /** Gemini Developer API key (global endpoint, used in "simulated" routing mode). */
    GEMINI_API_KEY: z.string().optional(),
    /** GCP project for Vertex AI. When set, requests execute in the selected region. */
    GOOGLE_CLOUD_PROJECT: z.string().optional(),
    /** auto = regional if GOOGLE_CLOUD_PROJECT is set, otherwise global. */
    INFERENCE_MODE: z.enum(['auto', 'regional', 'global']).default('auto'),
    DEFAULT_MODEL: z.string().default('gemini-3.8-flash'),
    ALLOWED_MODELS: z.string().default('gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.5-flash').transform(csv),
    MAX_PROMPT_CHARS: z.coerce.number().int().positive().default(4000),
    INFERENCE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    MAX_FAILOVER_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(2),

    // --- Cache -------------------------------------------------------------
    REDIS_URL: z.string().optional(),
    CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    CACHE_OP_TIMEOUT_MS: z.coerce.number().int().positive().default(500),

    // --- HTTP / abuse protection -------------------------------------------
    CORS_ORIGINS: z.string().default('https://carbon-route-alpha.vercel.app,http://localhost:5173').transform(csv),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    /** Number of reverse-proxy hops to trust for client IPs (Render/ALB/Cloud Run = 1). */
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),

    // --- Telemetry ---------------------------------------------------------
    ELECTRICITY_MAPS_API_KEY: z.string().optional(),
    /** Grid carbon data updates roughly hourly; 15 minutes keeps us well within API quotas. */
    CARBON_REFRESH_MS: z.coerce.number().int().min(60_000).default(15 * 60_000),
    LATENCY_PROBE_ENABLED: bool.default(true),
    LATENCY_REFRESH_MS: z.coerce.number().int().min(10_000).default(2 * 60_000),
    /**
     * Energy assumed per text request, used for gram estimates. Default is Google's
     * published median for a Gemini Apps text prompt (0.24 Wh, Aug 2025).
     */
    ENERGY_PER_REQUEST_WH: z.coerce.number().positive().default(0.24),
});

export type RawEnv = z.infer<typeof EnvSchema>;

export interface AppConfig extends RawEnv {
    /** Resolved execution mode after applying INFERENCE_MODE=auto. */
    resolvedInferenceMode: 'regional' | 'global';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    // Treat empty strings as "unset" so `FOO=` in a .env file falls back to defaults.
    const cleaned = Object.fromEntries(
        Object.entries(env).filter(([, v]) => v !== undefined && v !== '')
    );

    const parsed = EnvSchema.safeParse(cleaned);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map(i => `  - ${i.path.join('.')}: ${i.message}`)
            .join('\n');
        throw new Error(`Invalid environment configuration:\n${issues}`);
    }

    const cfg = parsed.data;

    let resolvedInferenceMode: 'regional' | 'global';
    if (cfg.INFERENCE_MODE === 'regional') {
        if (!cfg.GOOGLE_CLOUD_PROJECT) {
            throw new Error('INFERENCE_MODE=regional requires GOOGLE_CLOUD_PROJECT to be set.');
        }
        resolvedInferenceMode = 'regional';
    } else if (cfg.INFERENCE_MODE === 'global') {
        resolvedInferenceMode = 'global';
    } else {
        resolvedInferenceMode = cfg.GOOGLE_CLOUD_PROJECT ? 'regional' : 'global';
    }

    if (!cfg.ALLOWED_MODELS.includes(cfg.DEFAULT_MODEL)) {
        cfg.ALLOWED_MODELS.push(cfg.DEFAULT_MODEL);
    }

    return { ...cfg, resolvedInferenceMode };
}
