import { describe, it, expect } from 'vitest';
import { MemoryCache, CachedCompletion } from './cache';

const sampleValue = (tag: string): CachedCompletion => ({
    text: `Response for ${tag}`,
    model: 'gemini-3.8-flash',
    region: 'europe-north1',
    location: 'Finland',
    cachedAt: '2026-11-26T00:00:00.000Z',
});

describe('MemoryCache LRU Semantics', () => {
    it('evicts the least recently used entry rather than FIFO insertion order', async () => {
        const cache = new MemoryCache(300, 3);

        await cache.set('A', sampleValue('A'));
        await cache.set('B', sampleValue('B'));
        await cache.set('C', sampleValue('C'));
        expect(cache.size).toBe(3);

        // Touch 'A' so insertion/recency order becomes: B (oldest), C, A (most recent)
        const hitA = await cache.get('A');
        expect(hitA?.text).toBe('Response for A');

        // Insert 'D' — must evict 'B' (LRU), keeping 'A', 'C', and 'D'
        await cache.set('D', sampleValue('D'));
        expect(cache.size).toBe(3);

        expect(await cache.get('B')).toBeNull();
        expect((await cache.get('A'))?.text).toBe('Response for A');
        expect((await cache.get('C'))?.text).toBe('Response for C');
        expect((await cache.get('D'))?.text).toBe('Response for D');
    });

    it('updates existing keys in-place to MRU without exceeding capacity', async () => {
        const cache = new MemoryCache(300, 3);

        await cache.set('A', sampleValue('A1'));
        await cache.set('B', sampleValue('B'));
        await cache.set('C', sampleValue('C'));

        // Updating 'A' pushes it to MRU so 'B' becomes LRU
        await cache.set('A', sampleValue('A2'));
        await cache.set('D', sampleValue('D'));

        expect(cache.size).toBe(3);
        expect(await cache.get('B')).toBeNull();
        expect((await cache.get('A'))?.text).toBe('Response for A2');
    });

    it('expires stale entries cleanly on read', async () => {
        const cache = new MemoryCache(-1, 3); // immediate expiration
        await cache.set('expired', sampleValue('expired'));

        expect(await cache.get('expired')).toBeNull();
        expect(cache.size).toBe(0);
    });
});
