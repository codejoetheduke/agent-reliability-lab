import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';

const health = { service: 'agent-reliability-lab', status: 'ok', mode: 'mock', version: '0.1.0' };
function mockFetch(
  healthResponse = vi.fn().mockImplementation(async () => new Response(JSON.stringify(health))),
) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/health')) return healthResponse();
    if (url.endsWith('/config'))
      return new Response(
        JSON.stringify({
          openai_configured: false,
          openai_model: 'gpt-4.1-mini',
          mock_available: true,
          notion_configured: false,
          notion_scope_count: 0,
          notion_read_only: true,
          pricing_configured: false,
          provider_timeout_seconds: 30,
          history_storage: 'SQLite',
          credentials_in_frontend: false,
        }),
      );
    const body = url.endsWith('/overview')
      ? { run_count: 0, latest_run: null, metric_run: null, recent_failures: [] }
      : url.endsWith('/datasets')
        ? [
            {
              id: 'synthetic-v1',
              version: '1.0.0',
              description: 'Synthetic fixtures',
              test_count: 20,
            },
          ]
        : [];
    return new Response(JSON.stringify(body));
  });
}
afterEach(() => vi.unstubAllGlobals());

it('shows mock mode and a verified backend connection without credentials', async () => {
  vi.stubGlobal('fetch', mockFetch());
  render(<App />);
  expect(screen.getByText('MOCK MODE')).toBeVisible();
  expect(await screen.findByText('Backend connected')).toBeVisible();
  expect(await screen.findByText('No most recent run')).toBeVisible();
});

it('shows an offline state and recovers after a connection retry', async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Network unavailable'))
    .mockImplementation(async () => new Response(JSON.stringify(health)));
  vi.stubGlobal('fetch', mockFetch(fetchMock));
  render(<App />);
  expect(await screen.findByText('Backend offline')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Check connection' }));
  expect(await screen.findByText('Backend connected')).toBeVisible();
});

it('navigates all sections and keeps unavailable operations disabled', async () => {
  vi.stubGlobal('fetch', mockFetch());
  render(<App />);
  const nav = within(screen.getByRole('navigation'));
  for (const name of [
    'Agent Playground',
    'Evaluations',
    'Model Comparison',
    'Run History',
    'Settings',
  ]) {
    await userEvent.click(nav.getByRole('button', { name }));
    expect(screen.getByRole('heading', { level: 1, name })).toBeVisible();
    if (name === 'Agent Playground')
      expect(await screen.findByRole('button', { name: 'Send question' })).toBeDisabled();
  }
  expect(
    await screen.findByText('Secret values stay in the backend; they are never displayed here.'),
  ).toBeVisible();
});
