import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { loadConfig } from './config';
import { createLogger } from './logger';
import { RedisCache } from './cache';
import { GeminiInferenceProvider } from './inference';
import { startTelemetryWorker, telemetryCache } from './telemetry';
import { RegionSnapshot } from './regions';

async function bootstrap() {
    const config = loadConfig(process.env);
    const logger = createLogger(config.LOG_LEVEL, config.NODE_ENV !== 'production');
    
    // Telemetry mock adapter
    startTelemetryWorker();
    const telemetry = {
        status: () => ({ live: true }),
        snapshot: () => (telemetryCache.get('live_regions') as RegionSnapshot[]) || []
    };

    const cache = config.REDIS_URL 
        ? new RedisCache(config.REDIS_URL, config.CACHE_TTL_SECONDS, config.CACHE_OP_TIMEOUT_MS, logger)
        : new (require('./cache').MemoryCache)();

    const inference = new GeminiInferenceProvider({
        mode: config.resolvedInferenceMode,
        apiKey: config.GEMINI_API_KEY,
        project: config.GOOGLE_CLOUD_PROJECT,
        timeoutMs: config.INFERENCE_TIMEOUT_MS,
        maxAttempts: config.MAX_FAILOVER_ATTEMPTS,
        logger
    });

    const app = createApp({ config, telemetry, cache, inference, logger });

    app.listen(config.PORT, () => {
        logger.info({ port: config.PORT, mode: config.resolvedInferenceMode }, 'server started');
    });
}

bootstrap().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});