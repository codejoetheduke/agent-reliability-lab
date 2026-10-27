import { z } from 'zod';
import { rateSchema, runSchema } from './evaluation';

const interval = z.object({ lower: z.number(), upper: z.number() }).nullable();
export const comparisonSchema = z.object({
  comparable: z.boolean(),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  left: runSchema,
  right: runSchema,
  metrics: z.array(
    z.object({
      name: z.string(),
      left: rateSchema.nullable(),
      right: rateSchema.nullable(),
      delta: z.number().nullable(),
    }),
  ),
  left_pass_interval: interval,
  right_pass_interval: interval,
  case_differences: z.array(
    z.object({
      test_id: z.string(),
      category: z.string(),
      left_passed: z.boolean(),
      right_passed: z.boolean(),
      left_error: z.string().nullable(),
      right_error: z.string().nullable(),
    }),
  ),
  latency_histogram: z.array(
    z.object({
      start_ms: z.number(),
      end_ms: z.number(),
      left_count: z.number(),
      right_count: z.number(),
    }),
  ),
  improved: z.number(),
  regressed: z.number(),
  unchanged: z.number(),
});
export type ComparisonResult = z.infer<typeof comparisonSchema>;
