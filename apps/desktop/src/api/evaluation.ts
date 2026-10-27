import { z } from 'zod';
import { answerSchema } from './contracts';

export const rateSchema = z.object({
  numerator: z.number(),
  denominator: z.number(),
  value: z.number().nullable(),
});
export const summarySchema = z.object({
  tests_completed: z.number(),
  tests_passed: z.number(),
  pass_rate: rateSchema,
  failure_rate: rateSchema,
  provider_failure_rate: rateSchema.nullable().default(null),
  injected_faults: z.number().default(0),
  metrics: z.record(z.string(), rateSchema),
  failures_by_category: z.record(z.string(), z.number()),
  latency_ms: z.object({
    median: z.number().nullable(),
    p95: z.number().nullable(),
    mean: z.number().nullable(),
    values: z.array(z.number()),
  }),
  input_tokens: z.number().nullable(),
  output_tokens: z.number().nullable(),
  estimated_cost_usd: z.number().nullable(),
});
export const runSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'interrupted']),
  dataset_id: z.string(),
  dataset_version: z.string(),
  dataset_hash: z.string(),
  fixture_hash: z.string(),
  metric_version: z.string(),
  top_k: z.number(),
  label: z.string(),
  provider: z.string(),
  model: z.string(),
  simulated: z.boolean(),
  prompt_version: z.string().default('legacy-mock-v1'),
  total_tests: z.number(),
  summary: summarySchema.nullable(),
  error: z.string().nullable(),
});
export const resultSchema = z.object({
  fault_injected: z.boolean().default(false),
  test_id: z.string(),
  category: z.string(),
  question: z.string(),
  expected: z.record(z.string(), z.unknown()),
  answer: answerSchema.nullable(),
  error: z.string().nullable(),
  latency_ms: z.number(),
  passed: z.boolean(),
  checks: z.record(z.string(), z.boolean()),
  metrics: z.record(z.string(), rateSchema),
});
export const detailSchema = runSchema.extend({ results: z.array(resultSchema) });
export const datasetSchema = z.object({
  id: z.string(),
  version: z.string(),
  description: z.string(),
  test_count: z.number(),
});
export const overviewSchema = z.object({
  run_count: z.number(),
  latest_run: runSchema.nullable(),
  metric_run: runSchema.nullable(),
  recent_failures: z.array(
    z.object({
      run_id: z.string(),
      test_id: z.string(),
      category: z.string(),
      question: z.string(),
    }),
  ),
});
export type Run = z.infer<typeof runSchema>;
export type RunDetail = z.infer<typeof detailSchema>;
export type OverviewInfo = z.infer<typeof overviewSchema>;
export type Rate = z.infer<typeof rateSchema>;
export type Dataset = z.infer<typeof datasetSchema>;
export function formatRate(rate: Rate | undefined) {
  return rate?.value == null ? '—' : `${(rate.value * 100).toFixed(1)}%`;
}
export function formatTime(value: number | null | undefined) {
  return value == null ? '—' : `${value.toFixed(1)} ms`;
}
