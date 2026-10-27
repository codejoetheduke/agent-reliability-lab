export type ProviderName = 'mock' | 'openai' | 'gemini';
export type ExecutionConfig = { provider: ProviderName; model: string; consent: boolean };
export const defaultExecution: ExecutionConfig = { provider: 'gemini', model: '', consent: false };
export const providerLabel = (provider: ProviderName) =>
  provider === 'gemini' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : 'Mock';
