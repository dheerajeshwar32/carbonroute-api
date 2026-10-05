import { GoogleGenAI } from '@google/genai';
import type { Logger } from 'pino';
import { ServiceUnavailableError, UpstreamError } from './errors';

export type ExecutionMode = 'regional' | 'global';

export interface FailoverAttempt {
    region: string;
    status: number | null;
    error: string;
}

export interface InferenceResult {
    text: string;
    /** Region the model actually ran in (null in global mode). */
    executedRegion: string | null;
    failover: FailoverAttempt[];
    usage: { promptTokens: number | null; outputTokens: number | null };
}

export interface InferenceProvider {
    readonly mode: ExecutionMode;
    /**
     * @param candidates Region ids in preference order. Regional providers try
     *                   them in turn (failover); global providers ignore them.
     */
    generate(model: string, prompt: string, candidates: string[]): Promise<InferenceResult>;
}

export interface GeminiProviderOptions {
    mode: ExecutionMode;
    apiKey?: string;
    project?: string;
    timeoutMs: number;
    maxAttempts: number;
    logger: Logger;
}

/** Status codes worth retrying in another region (model not offered there, quota, outage, timeout). */
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

function describeError(err: unknown): { status: number | null; message: string } {
    const e = err as { status?: unknown; message?: unknown; name?: unknown };
    const status = typeof e?.status === 'number' ? e.status : null;
    const message = typeof e?.message === 'string' ? e.message : String(err);
    return { status, message: message.slice(0, 300) };
}

/**
 * Gemini provider with two execution modes:
 *
 *  - regional: Vertex AI / Gemini Enterprise with `location` set to the chosen
 *    region, so the request genuinely executes there. On retryable failures it
 *    fails over to the next-best region from the scheduler's ranking.
 *  - global:   Gemini Developer API (single global endpoint). Routing is then a
 *    simulation — the response is labelled `execution_mode: "simulated"`.
 */
export class GeminiInferenceProvider implements InferenceProvider {
    readonly mode: ExecutionMode;
    private readonly clients = new Map<string, GoogleGenAI>();
    private readonly log: Logger;

    constructor(private readonly opts: GeminiProviderOptions) {
        this.mode = opts.mode;
        this.log = opts.logger.child({ component: 'inference', mode: opts.mode });
        if (opts.mode === 'regional' && !opts.project) {
            throw new Error('Regional inference requires a GCP project.');
        }
    }

    private clientFor(location: string | null): GoogleGenAI {
        const key = location ?? 'global';
        let client = this.clients.get(key);
        if (!client) {
            client = this.mode === 'regional'
                ? new GoogleGenAI({
                    enterprise: true,
                    project: this.opts.project,
                    location: location ?? undefined,
                    httpOptions: { timeout: this.opts.timeoutMs },
                })
                : new GoogleGenAI({
                    apiKey: this.opts.apiKey,
                    httpOptions: { timeout: this.opts.timeoutMs },
                });
            this.clients.set(key, client);
        }
        return client;
    }

    async generate(model: string, prompt: string, candidates: string[]): Promise<InferenceResult> {
        if (this.mode === 'global' && !this.opts.apiKey) {
            throw new ServiceUnavailableError('Inference is not configured (set GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT).');
        }

        const targets: (string | null)[] = this.mode === 'regional'
            ? candidates.slice(0, this.opts.maxAttempts)
            : [null];

        const failover: FailoverAttempt[] = [];

        for (const region of targets) {
            try {
                const response = await this.clientFor(region).models.generateContent({
                    model,
                    contents: prompt,
                });
                const text = response.text;
                if (!text) {
                    throw new UpstreamError('The model returned no text (the response may have been blocked by safety filters).');
                }
                return {
                    text,
                    executedRegion: region,
                    failover,
                    usage: {
                        promptTokens: response.usageMetadata?.promptTokenCount ?? null,
                        outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
                    },
                };
            } catch (err) {
                if (err instanceof UpstreamError) throw err;
                const { status, message } = describeError(err);
                const retryable = status === null || RETRYABLE.has(status);
                this.log.warn({ region, status, retryable, err: message }, 'model call failed');
                failover.push({ region: region ?? 'global', status, error: message });
                if (!retryable) break;
            }
        }

        const last = failover[failover.length - 1];
        throw new UpstreamError(
            this.mode === 'regional'
                ? `Model call failed in ${failover.length} region(s).`
                : 'Model call failed.',
            { attempts: failover, last_status: last?.status ?? null }
        );
    }
}
