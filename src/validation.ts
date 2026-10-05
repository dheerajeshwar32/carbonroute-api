import { z } from 'zod';

const weight = z.number().finite().min(0, 'must be >= 0').max(1, 'must be <= 1');

export function buildInferenceSchema(opts: { maxPromptChars: number; allowedModels: string[] }) {
    return z.object({
        prompt: z
            .string({ error: 'prompt must be a string' })
            .trim()
            .min(1, 'prompt must not be empty')
            .max(opts.maxPromptChars, `prompt must be at most ${opts.maxPromptChars} characters`),
        model: z
            .string()
            .refine(m => opts.allowedModels.includes(m), {
                message: `model must be one of: ${opts.allowedModels.join(', ')}`,
            })
            .optional(),
        sla: z.object({
            max_latency_ms: z.number().int().positive().max(10_000),
            carbon_priority_weight: weight.optional(),
            cost_priority_weight: weight.optional(),
        }),
    });
}

export type InferenceRequest = z.infer<ReturnType<typeof buildInferenceSchema>>;

/** Flatten zod issues into a compact, client-friendly list. */
export const formatIssues = (error: z.ZodError) =>
    error.issues.map(i => ({ field: i.path.join('.') || '(body)', message: i.message }));
