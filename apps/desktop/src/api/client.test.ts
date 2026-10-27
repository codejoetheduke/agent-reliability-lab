import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from './client';

afterEach(() => vi.unstubAllGlobals());
describe('health API contract', () => {
  it('rejects an unrelated or malformed service', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }))),
    );
    await expect(getHealth()).rejects.toThrow('incompatible');
  });
  it('rejects a failed HTTP request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(getHealth()).rejects.toThrow('returned an error');
  });
});
