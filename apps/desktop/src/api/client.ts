import { runtimeSession, sessionHeaders } from './session';

export interface Health {
  service: 'agent-reliability-lab';
  status: 'ok';
  mode: 'mock' | 'live';
  version: '0.1.0';
}

export const API_URL = 'http://127.0.0.1:8765';

export async function apiRequest(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<unknown> {
  const { timeoutMs = 30000, ...requestOptions } = options;
  const { api_url } = await runtimeSession();
  const response = await fetch(`${api_url}${path}`, {
    ...requestOptions,
    headers: {
      ...(await sessionHeaders()),
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'The local service could not complete this request.';
    throw new Error(message);
  }
  return response.json();
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const { api_url } = await runtimeSession();
  const timeout = AbortSignal.timeout(4000);
  const response = await fetch(`${api_url}/health`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('The local backend returned an error.');
  const value: unknown = await response.json();
  if (
    typeof value !== 'object' ||
    value === null ||
    !('service' in value) ||
    value.service !== 'agent-reliability-lab' ||
    !('status' in value) ||
    value.status !== 'ok' ||
    !('mode' in value) ||
    !['mock', 'live'].includes(String(value.mode)) ||
    !('version' in value) ||
    value.version !== '0.1.0'
  ) {
    throw new Error('The local backend returned an incompatible health response.');
  }
  return value as Health;
}
