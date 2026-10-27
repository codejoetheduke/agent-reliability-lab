import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';

const health = { service: 'agent-reliability-lab', status: 'ok', mode: 'mock', version: '0.1.0' };
afterEach(() => vi.unstubAllGlobals());

it('shows mock mode and a verified backend connection without credentials', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => new Response(JSON.stringify(health))),
  );
  render(<App />);
  expect(screen.getByText('MOCK MODE')).toBeVisible();
  expect(await screen.findByText('Backend connected')).toBeVisible();
  expect(screen.getByText('No most recent run')).toBeVisible();
});

it('shows an offline state and recovers after a connection retry', async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Network unavailable'))
    .mockImplementation(async () => new Response(JSON.stringify(health)));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  expect(await screen.findByText('Backend offline')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Check connection' }));
  expect(await screen.findByText('Backend connected')).toBeVisible();
});

it('navigates all sections and keeps unavailable operations disabled', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => new Response(JSON.stringify(health))),
  );
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
      expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
  }
  expect(screen.getByText('Not loaded or required in this milestone')).toBeVisible();
});
