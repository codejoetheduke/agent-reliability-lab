import { useEffect, useState } from 'react';
import { z } from 'zod';
import { apiRequest } from '../api/client';

export const configSchema = z.object({
  openai_configured: z.boolean(),
  openai_model: z.string(),
  mock_available: z.boolean(),
  notion_configured: z.boolean(),
  notion_scope_count: z.number(),
  notion_read_only: z.boolean(),
  pricing_configured: z.boolean(),
  provider_timeout_seconds: z.number(),
  history_storage: z.string(),
  credentials_in_frontend: z.boolean(),
});
export type Config = z.infer<typeof configSchema>;
export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/config', { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setConfig(configSchema.parse(value));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Configuration status is unavailable.');
      });
    return () => controller.abort();
  }, []);
  return { config, error };
}
