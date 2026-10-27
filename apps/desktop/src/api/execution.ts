export type ProviderName = 'mock' | 'openai';
export type ExecutionConfig = { provider: ProviderName; model: string; consent: boolean };
export const defaultExecution: ExecutionConfig = { provider: 'mock', model: '', consent: false };
