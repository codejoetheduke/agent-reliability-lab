import { z } from 'zod';

export const factSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  value: z.string(),
  quote: z.string(),
});
export const recordSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(['plan', 'meeting', 'task', 'decision', 'note']),
  body: z.string(),
  facts: z.array(factSchema),
  url: z
    .string()
    .url()
    .refine((value) => value.startsWith('https://'))
    .nullable(),
});
export const answerSchema = z.object({
  answer: z.string(),
  claims: z.array(
    z.object({
      text: z.string(),
      citations: z.array(z.object({ record_id: z.string(), quote: z.string() })),
    }),
  ),
  abstained: z.boolean(),
  reason: z.enum([
    'answered',
    'insufficient_evidence',
    'conflicting_evidence',
    'action_requires_confirmation',
  ]),
  sources: z.array(recordSchema),
  provider: z.string(),
  simulated: z.boolean(),
  latency_ms: z.number(),
  input_tokens: z.number().nullable(),
  output_tokens: z.number().nullable(),
  estimated_cost_usd: z.number().nullable(),
  model: z.string().default('extractive-mock-v1'),
  provider_latency_ms: z.number().nullable().default(null),
});
export type AgentAnswer = z.infer<typeof answerSchema>;
export type SourceRecord = z.infer<typeof recordSchema>;
