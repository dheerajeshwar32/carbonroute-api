import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import type { Logger } from 'pino';

export type CacheStatus = 'up' | 'down' | 'disabled';

/** What we store per cached completion. */
export interface CachedCompletion {
    text: string;
    model: string;
    region: string | null;
    location: string | null;
    cachedAt: string;
}

/**
 * Response cache contract. Implementations must NEVER throw: the cache is an
 * optimisation, so any failure degrades to a miss / no-op rather than an error.
 */
export interface ResponseCache {
    get(key: string): Promise<CachedCompletion | null>;
    set(key: string, value: CachedCompletion): Promise<void>;
    status(): CacheStatus;
    close(): Promise<void>;
}

const CACHE_VERSION = 'v1';

/** Whitespace-insensitive, but case-sensitive (case can change meaning). */
export const normalizePrompt = (prompt: string) => prompt.trim().replace(/\s+/g, ' ');

/**
 * Namespaced, fixed-length cache key. Hashing keeps keys bounded and avoids
 * storing raw prompts as Redis keys; including the model prevents one model's
 * answer being served for another.
 */
export function cacheKey(model: string, prompt: string): string {
    const digest = createHash('sha256').update(normalizePrompt(prompt)).digest('hex');
    return `cr:${CACHE_VERSION}:${model}:${digest}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`cache op timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class NoopCache implements ResponseCache {
    async get() { return null; }
    async set() { /* no-op */ }
    status(): CacheStatus { return 'disabled'; }
    async close() { /* no-op */ }
}

/** In-process LRU-ish cache. Handy for tests and local dev without Redis. */
export class MemoryCache implements ResponseCache {
    private readonly store = new Map<string, { value: CachedCompletion; expires: number }>();
    constructor(private readonly ttlSeconds = 3600, private readonly maxEntries = 500) {}
    async get(key: string) {
        const hit = this.store.get(key);
        if (!hit) return null;
        if (hit.expires < Date.now()) { this.store.delete(key); return null; }
        return hit.value;
    }
    async set(key: string, value: CachedCompletion) {
        if (this.store.size >= this.maxEntries) {
            const oldest = this.store.keys().next().value;
            if (oldest !== undefined) this.store.delete(oldest);
        }
        this.store.set(key, { value, expires: Date.now() + this.ttlSeconds * 1000 });
    }
    status(): CacheStatus { return 'up'; }
    async close() { this.store.clear(); }
}

export class RedisCache implements ResponseCache {
    private readonly client;
    private readonly log: Logger;
    private lastErrorLog = 0;

    constructor(url: string, private readonly ttlSeconds: number, private readonly opTimeoutMs: number, logger: Logger) {
        this.log = logger.child({ component: 'cache' });
        this.client = createClient({
            url,
            // Fail fast while disconnected instead of queueing commands forever.
            disableOfflineQueue: true,
            socket: {
                connectTimeout: 5_000,
                reconnectStrategy: retries => Math.min(1_000 * 2 ** retries, 30_000),
            },
        });
        this.client.on('ready', () => this.log.info('redis connected'));
        this.client.on('error', err => {
            // node-redis emits on every reconnect attempt — throttle the noise.
            if (Date.now() - this.lastErrorLog > 30_000) {
                this.lastErrorLog = Date.now();
                this.log.warn({ err: err?.message ?? String(err) }, 'redis unavailable — serving without cache');
            }
        });
        this.client.connect().catch(() => { /* handled by 'error' + reconnectStrategy */ });
    }

    status(): CacheStatus {
        return this.client.isReady ? 'up' : 'down';
    }

    async get(key: string): Promise<CachedCompletion | null> {
        if (!this.client.isReady) return null;
        try {
            const raw = await withTimeout(this.client.get(key), this.opTimeoutMs);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as CachedCompletion;
            return typeof parsed?.text === 'string' ? parsed : null;
        } catch (err) {
            this.log.warn({ err: String(err) }, 'cache get failed — treating as miss');
            return null;
        }
    }

    async set(key: string, value: CachedCompletion): Promise<void> {
        if (!this.client.isReady) return;
        try {
            await withTimeout(this.client.setEx(key, this.ttlSeconds, JSON.stringify(value)), this.opTimeoutMs);
        } catch (err) {
            this.log.warn({ err: String(err) }, 'cache set failed');
        }
    }

    async close(): Promise<void> {
        try {
            if (this.client.isOpen) await this.client.quit();
        } catch {
            this.client.destroy();
        }
    }
}
