import { GoogleGenAI } from '@google/genai';
import type { Logger } from 'pino';
import { ServiceUnavailableError, UpstreamError } from './errors';

export type ExecutionMode = 'regional' | 'global';

export interface FailoverAttempt {
    region: string;
    status: number | null;
    code: string | null;
    error: string;
    details?: unknown;
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
     * @param signal     Optional AbortSignal for client cancellation.
     */
    generate(
        model: string,
        prompt: string,
        candidates: string[],
        signal?: AbortSignal
    ): Promise<InferenceResult>;
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

export interface ParsedErrorDiagnostics {
    status: number | null;
    code: string | null;
    message: string;
    details: unknown;
}

function tryExtractJsonError(str: string): Record<string, unknown> | null {
    const match = str.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        const obj = JSON.parse(match[0]);
        if (obj && typeof obj === 'object') {
            if (obj.error && typeof obj.error === 'object') {
                return obj.error as Record<string, unknown>;
            }
            return obj as Record<string, unknown>;
        }
    } catch {
        return null;
    }
    return null;
}

export function describeError(err: unknown): ParsedErrorDiagnostics {
    if (!err || typeof err !== 'object') {
        const raw = String(err);
        const embedded = tryExtractJsonError(raw);
        if (embedded) {
            const rawCode = embedded.code ?? embedded.status;
            const is504 = rawCode === 504 || rawCode === '504' || embedded.status === 'DEADLINE_EXCEEDED';
            return {
                status: is504 ? 504 : (typeof rawCode === 'number' ? rawCode : null),
                code: is504 ? 'DEADLINE_EXCEEDED' : (embedded.status ? String(embedded.status) : (embedded.code ? String(embedded.code) : null)),
                message: is504
                    ? 'Upstream Gemini model timed out (504 DEADLINE_EXCEEDED). The gateway automatically attempted regional failover — please retry.'
                    : (typeof embedded.message === 'string' ? embedded.message : raw),
                details: embedded.details ?? embedded,
            };
        }
        return { status: null, code: null, message: raw, details: null };
    }

    const e = err as {
        name?: unknown;
        status?: unknown;
        statusCode?: unknown;
        code?: unknown;
        statusText?: unknown;
        message?: unknown;
        errorDetails?: unknown;
        details?: unknown;
        response?: { data?: unknown; status?: unknown };
    };

    let status = typeof e.status === 'number'
        ? e.status
        : typeof e.statusCode === 'number'
            ? e.statusCode
            : typeof e.response?.status === 'number'
                ? e.response.status
                : null;

    let code = typeof e.code === 'string'
        ? e.code
        : typeof e.code === 'number'
            ? String(e.code)
            : null;

    let message = typeof e.message === 'string' ? e.message : String(err);
    let details = e.errorDetails ?? e.details ?? e.response?.data ?? null;

    // Check for JSON embedded in message or details string
    const embedded = tryExtractJsonError(message);
    if (embedded) {
        if (!status && typeof embedded.code === 'number') status = embedded.code;
        if (!code && embedded.status) code = String(embedded.status);
        if (!details && embedded.details) details = embedded.details;
        if (embedded.code === 504 || embedded.status === 'DEADLINE_EXCEEDED' || status === 504) {
            status = 504;
            code = 'DEADLINE_EXCEEDED';
            message = 'Upstream Gemini model timed out (504 DEADLINE_EXCEEDED). The gateway automatically attempted regional failover — please retry.';
        } else if (typeof embedded.message === 'string') {
            message = embedded.message;
        }
    } else if (
        status === 504 ||
        code === '504' ||
        code === 'DEADLINE_EXCEEDED' ||
        /deadline expired/i.test(message) ||
        /DEADLINE_EXCEEDED/i.test(message) ||
        (e.name === 'TimeoutError' && !/client disconnect/i.test(message))
    ) {
        status = 504;
        code = 'DEADLINE_EXCEEDED';
        message = 'Upstream Gemini model timed out (504 DEADLINE_EXCEEDED). The gateway automatically attempted regional failover — please retry.';
    }

    return { status, code, message, details };
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

    async generate(
        model: string,
        prompt: string,
        candidates: string[],
        signal?: AbortSignal
    ): Promise<InferenceResult> {
        if (signal?.aborted) {
            throw new UpstreamError('Inference request was cancelled prior to execution.', { cancelled: true });
        }

        if (this.mode === 'global' && !this.opts.apiKey) {
            throw new ServiceUnavailableError('Inference is not configured (set GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT).');
        }

        const targets: (string | null)[] = this.mode === 'regional'
            ? candidates.slice(0, this.opts.maxAttempts)
            : [null];

        const failover: FailoverAttempt[] = [];

        for (const region of targets) {
            if (signal?.aborted) {
                throw new UpstreamError('Inference request was aborted during regional dispatch.', {
                    cancelled: true,
                    region,
                });
            }

            const attemptTimeout = AbortSignal.timeout(this.opts.timeoutMs);
            const combinedSignal = signal && typeof AbortSignal.any === 'function'
                ? AbortSignal.any([signal, attemptTimeout])
                : (signal ?? attemptTimeout);

            try {
                const response = await this.clientFor(region).models.generateContent({
                    model,
                    contents: prompt,
                    config: {
                        thinkingConfig: { thinkingBudget: 0 },
                        abortSignal: combinedSignal,
                    } as any,
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
                if (signal?.aborted) {
                    throw new UpstreamError('Inference request aborted by client disconnect.', { cancelled: true });
                }

                if (err instanceof UpstreamError) throw err;

                let { status, code, message, details } = describeError(err);
                if (attemptTimeout.aborted && !signal?.aborted) {
                    status = 504;
                    code = 'DEADLINE_EXCEEDED';
                    message = 'Upstream Gemini model timed out (504 DEADLINE_EXCEEDED). The gateway automatically attempted regional failover — please retry.';
                }

                const retryable = status === null || RETRYABLE.has(status);

                this.log.warn(
                    { region, status, code, retryable, err: message, details },
                    'model call failed'
                );

                failover.push({
                    region: region ?? 'global',
                    status,
                    code,
                    error: message,
                    details,
                });

                if (!retryable) break;
            }
        }

        const last = failover[failover.length - 1];
        throw new UpstreamError(
            this.mode === 'regional'
                ? `Model call failed in ${failover.length} region(s).`
                : `Model call failed: ${last?.error || 'Unknown upstream failure'}`,
            {
                attempts: failover,
                last_status: last?.status ?? null,
                last_code: last?.code ?? null,
                last_details: last?.details ?? null,
            }
        );
    }
}
