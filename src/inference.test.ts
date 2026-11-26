import { describe, it, expect, vi } from 'vitest';
import { ThinkingLevel } from '@google/genai';
import pino from 'pino';
import { GeminiInferenceProvider, buildGenerateConfig, tryExtractJsonError, describeError } from './inference';
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

describe('buildGenerateConfig (Model-Specific Thinking Controls)', () => {
    const controller = new AbortController();

    it('uses ThinkingLevel.MINIMAL on gemini-3.5-flash-lite instead of legacy thinkingBudget: 0', () => {
        const cfg = buildGenerateConfig('gemini-3.5-flash-lite', controller.signal);
        expect(cfg.thinkingConfig).toEqual({ thinkingLevel: ThinkingLevel.MINIMAL });
        expect(cfg.abortSignal).toBe(controller.signal);
    });

    it('uses ThinkingLevel.LOW on gemini-4-hydrogen and gemini-3.8-flash', () => {
        expect(buildGenerateConfig('gemini-4-hydrogen', controller.signal).thinkingConfig).toEqual({
            thinkingLevel: ThinkingLevel.LOW,
        });
        expect(buildGenerateConfig('gemini-3.8-flash', controller.signal).thinkingConfig).toEqual({
            thinkingLevel: ThinkingLevel.LOW,
        });
    });

    it('omits thinkingConfig on gemini-3.1-flash-lite and preserves thinkingBudget: 0 on gemini-2.5-*', () => {
        expect(buildGenerateConfig('gemini-3.1-flash-lite', controller.signal)).toEqual({
            abortSignal: controller.signal,
        });
        expect(buildGenerateConfig('gemini-2.5-flash', controller.signal).thinkingConfig).toEqual({
            thinkingBudget: 0,
        });
    });
});

describe('GeminiInferenceProvider Failover, Retry & Abort', () => {
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

        const result = await provider.generate('gemini-3.5-flash-lite', 'Hello green grid', [
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

    it('retries transient 503 UNAVAILABLE in global mode before succeeding', async () => {
        const provider = new GeminiInferenceProvider({
            mode: 'global',
            apiKey: 'test-key',
            timeoutMs: 15000,
            maxAttempts: 2,
            logger,
        });

        const generateContent = vi.fn()
            .mockRejectedValueOnce(new Error('[GoogleGenAI Error]: {"error":{"code":503,"message":"High demand","status":"UNAVAILABLE"}}'))
            .mockResolvedValueOnce({
                text: 'Recovered on retry',
                usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 4 },
            });

        vi.spyOn(provider as unknown as { clientFor: () => unknown }, 'clientFor')
            .mockReturnValue({ models: { generateContent } });

        const result = await provider.generate('gemini-3.5-flash-lite', 'Capital of India', ['europe-north1']);
        expect(generateContent).toHaveBeenCalledTimes(2);
        expect(result.text).toBe('Recovered on retry');
        expect(result.failover).toHaveLength(1);
        expect(result.failover[0].status).toBe(503);
    });

    it('falls back without thinkingConfig if a model rejects thinking parameters with 400', async () => {
        const provider = new GeminiInferenceProvider({
            mode: 'global',
            apiKey: 'test-key',
            timeoutMs: 15000,
            maxAttempts: 2,
            logger,
        });

        const generateContent = vi.fn()
            .mockRejectedValueOnce(new Error('{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}'))
            .mockResolvedValueOnce({
                text: 'Fallback plain config succeeded',
                usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 },
            });

        vi.spyOn(provider as unknown as { clientFor: () => unknown }, 'clientFor')
            .mockReturnValue({ models: { generateContent } });

        const result = await provider.generate('gemini-3.5-flash-lite', 'Hello', ['europe-north1']);
        expect(generateContent).toHaveBeenCalledTimes(2);
        expect(generateContent.mock.calls[1][0].config.thinkingConfig).toBeUndefined();
        expect(result.text).toBe('Fallback plain config succeeded');
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
            provider.generate('gemini-3.5-flash-lite', 'Abort test', ['europe-north1', 'eu-west-1'], controller.signal)
        ).rejects.toThrow(UpstreamError);

        expect(generateContent).toHaveBeenCalledTimes(1);
    });
});

describe('TelemetryService Encapsulation', () => {
    it('isolates configuration and state per TelemetryService instance without process.env leaks', async () => {
        const svcA = new TelemetryService({ electricityMapsApiKey: undefined });
        const svcB = new TelemetryService({ electricityMapsApiKey: 'test-token-b' });

        expect(svcA.snapshot()).toHaveLength(5);
        expect(svcB.snapshot()).toHaveLength(5);
        expect(svcA.status().provider).toBe('simulated_baseline');

        await svcA.updateCarbonData();
        expect(svcA.status().provider).toBe('simulated_baseline');
        expect(svcA.snapshot()[0].carbonSource).toBe('fallback');

        svcA.stop();
        svcB.stop();
    });
});
