import { GoogleGenAI, ThinkingLevel } from '@google/genai';
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

/** Status codes worth retrying (model unavailable in region, quota spike, outage, timeout). */
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

export interface ParsedErrorDiagnostics {
    status: number | null;
    code: string | null;
    message: string;
    details: unknown;
}

/**
 * Selects model-appropriate thinkingConfig for @google/genai `models.generateContent`.
 * Gemini 3.5+ / 4.x reject legacy `thinkingBudget: 0` with 400 INVALID_ARGUMENT, while
 * default HIGH thinking causes latency timeouts; each family gets its lowest safe level.
 */
export function buildGenerateConfig(
    model: string,
    abortSignal: AbortSignal,
    omitThinking = false
): Record<string, unknown> {
    if (omitThinking) {
        return { abortSignal };
    }

    if (model.startsWith('gemini-2.5')) {
        return { thinkingConfig: { thinkingBudget: 0 }, abortSignal };
    }

    if (model === 'gemini-3.5-flash-lite' || model.startsWith('gemini-3.5-flash-lite-')) {
        return { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }, abortSignal };
    }

    if (model.startsWith('gemini-3.1-flash-lite')) {
        return { abortSignal };
    }

    if (model.startsWith('gemini-4-') || model.startsWith('gemini-3.')) {
        return { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, abortSignal };
    }

    return { abortSignal };
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error('Aborted'));
            return;
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

/**
 * Balanced-brace JSON extractor. Scans for the outermost `{...}` block by tracking
 * brace depth while respecting string literals and escape sequences, so it handles:
 *   - Arbitrarily nested JSON (2–4 levels deep)
 *   - Non-JSON braces preceding the actual payload (e.g. "Error in {config}: {...}")
 *   - Escaped quotes inside strings (`\"`)
 */
export function tryExtractJsonError(str: string): Record<string, unknown> | null {
    const len = str.length;

    for (let scanStart = 0; scanStart < len; scanStart++) {
        if (str[scanStart] !== '{') continue;

        let depth = 0;
        let inString = false;
        let escaped = false;
        let endIdx = -1;

        for (let i = scanStart; i < len; i++) {
            const ch = str[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (ch === '\\' && inString) {
                escaped = true;
                continue;
            }

            if (ch === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    endIdx = i;
                    break;
                }
            }
        }

        if (endIdx === -1) continue;

        const candidate = str.slice(scanStart, endIdx + 1);
        try {
            const obj = JSON.parse(candidate);
            if (obj && typeof obj === 'object') {
                if (obj.error && typeof obj.error === 'object') {
                    return obj.error as Record<string, unknown>;
                }
                return obj as Record<string, unknown>;
            }
        } catch {
            continue;
        }
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
 *    Supports transient 503/429 retry resilience up to `maxAttempts`.
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
            : Array.from({ length: Math.max(1, this.opts.maxAttempts) }, () => null);

        const failover: FailoverAttempt[] = [];
        let omitThinking = false;

        for (let idx = 0; idx < targets.length; idx++) {
            const region = targets[idx];
            if (signal?.aborted) {
                throw new UpstreamError('Inference request was aborted during dispatch.', {
                    cancelled: true,
                    region,
                });
            }

            const attemptTimeout = AbortSignal.timeout(this.opts.timeoutMs);
            const combinedSignal = signal && typeof AbortSignal.any === 'function'
                ? AbortSignal.any([signal, attemptTimeout])
                : (signal ?? attemptTimeout);

            const executeOnce = async (withoutThinking: boolean): Promise<InferenceResult> => {
                const response = await this.clientFor(region).models.generateContent({
                    model,
                    contents: prompt,
                    config: buildGenerateConfig(model, combinedSignal, withoutThinking) as any,
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
            };

            try {
                return await executeOnce(omitThinking);
            } catch (err) {
                if (signal?.aborted) {
                    throw new UpstreamError('Inference request aborted by client disconnect.', { cancelled: true });
                }

                if (err instanceof UpstreamError) throw err;

                let { status, code, message, details } = describeError(err);

                // If an unfamiliar custom model rejected thinkingConfig with 400, retry immediately without thinkingConfig
                if (
                    !omitThinking &&
                    status === 400 &&
                    /invalid argument|thinking/i.test(message)
                ) {
                    omitThinking = true;
                    this.log.warn({ model, region, err: message }, 'thinkingConfig unsupported by model; retrying with plain config');
                    try {
                        return await executeOnce(true);
                    } catch (fallbackErr) {
                        if (signal?.aborted) {
                            throw new UpstreamError('Inference request aborted by client disconnect.', { cancelled: true });
                        }
                        if (fallbackErr instanceof UpstreamError) throw fallbackErr;
                        ({ status, code, message, details } = describeError(fallbackErr));
                    }
                }

                const localTimedOut = attemptTimeout.aborted && !signal?.aborted;
                if (localTimedOut) {
                    status = 504;
                    code = 'DEADLINE_EXCEEDED';
                    message = 'Upstream Gemini model timed out (504 DEADLINE_EXCEEDED). The gateway automatically attempted regional failover — please retry.';
                }

                // In global mode, avoid double-waiting another full timeout if the local timeout already expired
                const retryable =
                    (status === null || RETRYABLE.has(status)) &&
                    !(region === null && localTimedOut);

                this.log.warn(
                    { region, model, status, code, retryable, err: message, details },
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

                // Brief backoff when retrying same global endpoint after transient 503/429
                if (region === null && idx < targets.length - 1) {
                    try {
                        await abortableDelay(300 * (idx + 1), signal);
                    } catch {
                        throw new UpstreamError('Inference request aborted by client disconnect.', { cancelled: true });
                    }
                }
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
