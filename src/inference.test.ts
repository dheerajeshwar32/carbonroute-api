import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';
import { GeminiInferenceProvider, tryExtractJsonError, describeError } from './inference';
import { TelemetryService } from './telemetry';
import { UpstreamError } from './errors';

describe('tryExtractJsonError (Balanced-Brace Scanner)', () => {
    it('ignores non-JSON braces preceding the actual JSON error payload', () => {
        const raw = 'Error in {config}: downstream returned {"error":{"code":504,"status":"DEADLINE_EXCEEDED","message":"Timed out"}}';
        const extracted = tryExtractJsonError(raw);
        expect(extracted).not.toBeNull();
        expect(extracted?.code).toBe(504);
        expect(extracted?.status).toBe('DEADLINE_EXCEEDED');
    });

    it('handles deeply nested JSON with braces and escaped quotes inside strings', () => {
        const raw = 'Upstream [fatal]: {"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded for {\\"region\\":\\"fi\\"}","details":{"meta":{"nested":{"depth":3}}}}}';
        const extracted = tryExtractJsonError(raw);
        expect(extracted).not.toBeNull();
        expect(extracted?.code).toBe(429);
        expect(extracted?.status).toBe('RESOURCE_EXHAUSTED');

        const diag = describeError(new Error(raw));
        expect(diag.status).toBe(429);
        expect(diag.code).toBe('RESOURCE_EXHAUSTED');
        expect(diag.message).toContain('Quota exceeded');
    });

    it('returns null when no valid JSON block is present', () => {
        expect(tryExtractJsonError('Plain text {unclosed error message')).toBeNull();
    });
});

describe('GeminiInferenceProvider Regional Failover & Abort', () => {
    const logger = pino({ level: 'silent' });

    it('fails over from primary region (504) to secondary region and records attempt telemetry', async () => {
        const provider = new GeminiInferenceProvider({
            mode: 'regional',
            project: 'carbonroute-prod',
            timeoutMs: 15000,
            maxAttempts: 2,
            logger,
        });

        const primaryClient = {
            models: {
                generateContent: vi.fn().mockRejectedValue(
                    new Error('[GoogleGenAI Error]: {"error":{"code":504,"message":"Deadline expired","status":"DEADLINE_EXCEEDED"}}')
                ),
            },
        };

        const secondaryClient = {
            models: {
                generateContent: vi.fn().mockResolvedValue({
                    text: 'Failover succeeded in Netherlands',
                    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 14 },
                }),
            },
        };

        vi.spyOn(provider as unknown as { clientFor: (loc: string | null) => unknown }, 'clientFor')
            .mockImplementation((loc: string | null) => (loc === 'europe-north1' ? primaryClient : secondaryClient));

        const result = await provider.generate('gemini-3.8-flash', 'Hello green grid', [
            'europe-north1',
            'europe-west4',
        ]);

        expect(primaryClient.models.generateContent).toHaveBeenCalledTimes(1);
        expect(secondaryClient.models.generateContent).toHaveBeenCalledTimes(1);
        expect(result.executedRegion).toBe('europe-west4');
        expect(result.text).toBe('Failover succeeded in Netherlands');
        expect(result.failover).toHaveLength(1);
        expect(result.failover[0].region).toBe('europe-north1');
        expect(result.failover[0].status).toBe(504);
        expect(result.failover[0].code).toBe('DEADLINE_EXCEEDED');
    });

    it('throws immediately on client abort without attempting additional regions', async () => {
        const provider = new GeminiInferenceProvider({
            mode: 'regional',
            project: 'carbonroute-prod',
            timeoutMs: 15000,
            maxAttempts: 3,
            logger,
        });

        const controller = new AbortController();
        const generateContent = vi.fn().mockImplementation(async ({ config }: { config: { abortSignal: AbortSignal } }) => {
            expect(config.abortSignal).toBeDefined();
            controller.abort();
            throw new Error('Request aborted');
        });

        vi.spyOn(provider as unknown as { clientFor: () => unknown }, 'clientFor')
            .mockReturnValue({ models: { generateContent } });

        await expect(
            provider.generate('gemini-3.8-flash', 'Abort test', ['europe-north1', 'eu-west-1'], controller.signal)
        ).rejects.toThrow(UpstreamError);

        expect(generateContent).toHaveBeenCalledTimes(1);
    });
});

describe('TelemetryService Encapsulation', () => {
    it('isolates configuration and state per TelemetryService instance without process.env leaks', async () => {
        const svcA = new TelemetryService({ electricityMapsApiKey: undefined });
        const svcB = new TelemetryService({ electricityMapsApiKey: 'test-token-b' });

        // Both cold-boot synchronously
        expect(svcA.snapshot()).toHaveLength(5);
        expect(svcB.snapshot()).toHaveLength(5);
        expect(svcA.status().provider).toBe('simulated_baseline');

        await svcA.updateCarbonData();
        expect(svcA.status().provider).toBe('simulated_baseline');
        expect(svcA.snapshot()[0].carbonSource).toBe('fallback');

        // Clean shutdown stops timers safely
        svcA.stop();
        svcB.stop();
    });
});
