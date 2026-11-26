import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { loadConfig } from './config';
import { createLogger } from './logger';
import { RedisCache, MemoryCache } from './cache';
import { GeminiInferenceProvider } from './inference';
import { TelemetryService } from './telemetry';

async function bootstrap() {
    const config = loadConfig(process.env);
    const logger = createLogger(config.LOG_LEVEL, config.NODE_ENV !== 'production');

    // Encapsulated telemetry service — synchronously seeded with baseline snapshots
    const telemetry = new TelemetryService({
        electricityMapsApiKey: config.ELECTRICITY_MAPS_API_KEY,
        pollIntervalMs: config.CARBON_REFRESH_MS,
    }).start();

    const cache = config.REDIS_URL
        ? new RedisCache(config.REDIS_URL, config.CACHE_TTL_SECONDS, config.CACHE_OP_TIMEOUT_MS, logger)
        : new MemoryCache(config.CACHE_TTL_SECONDS);

    const inference = new GeminiInferenceProvider({
        mode: config.resolvedInferenceMode,
        apiKey: config.GEMINI_API_KEY,
        project: config.GOOGLE_CLOUD_PROJECT,
        timeoutMs: config.INFERENCE_TIMEOUT_MS,
        maxAttempts: config.MAX_FAILOVER_ATTEMPTS,
        logger,
    });

    const app = createApp({ config, telemetry, cache, inference, logger });

    const server = app.listen(config.PORT, () => {
        logger.info({ port: config.PORT, mode: config.resolvedInferenceMode }, 'server started');
    });

    // Graceful shutdown handling (SIGTERM / SIGINT)
    const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Graceful shutdown initiated; releasing resources...');
        telemetry.stop();

        server.close(async () => {
            logger.info('HTTP server closed.');
            try {
                await cache.close();
                logger.info('Cache connections closed.');
            } catch (err) {
                logger.warn({ err }, 'Error closing cache connection');
            }
            logger.info('Graceful shutdown complete.');
            process.exit(0);
        });

        // Enforce hard exit after 10s timeout
        setTimeout(() => {
            logger.error('Shutdown deadline exceeded; forcing exit.');
            process.exit(1);
        }, 10_000).unref();
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));

    // Process-level crash handlers
    process.on('unhandledRejection', (reason) => {
        logger.fatal({ reason }, 'Unhandled Promise Rejection');
    });

    process.on('uncaughtException', (err) => {
        logger.fatal({ err }, 'Uncaught Exception detected; initiating emergency shutdown');
        telemetry.stop();
        server.close(() => {
            process.exit(1);
        });
        setTimeout(() => process.exit(1), 5_000).unref();
    });
}

bootstrap().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
