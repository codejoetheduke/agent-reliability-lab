import { test, expect } from '@playwright/test';

test('credential-free shell connects to the real local backend and navigates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByText('MOCK MODE', { exact: true })).toBeVisible();
  await expect(page.getByText('Backend connected')).toBeVisible();
  const health = await page.request.get('http://127.0.0.1:8765/health');
  expect((await health.json()).mode).toBe('mock');
  await page.screenshot({ path: 'docs/screenshots/overview.png', fullPage: true });
  await page.getByRole('navigation').getByRole('button', { name: 'Agent Playground' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Agent Playground' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send question' })).toBeDisabled();
  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Not loaded or required in this milestone')).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile navigation opens, dismisses with Escape, and selects a page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(url.hostname))
      externalRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByText('Backend connected')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation')).not.toBeVisible();
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('navigation')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(externalRequests).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/mobile-settings.png', fullPage: true });
});

test('compact layout remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 700 });
  await page.goto('/');
  await expect(page.getByText('Backend connected')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('navigation').getByRole('button', { name: 'Run History' }).click();
  await expect(page.getByRole('heading', { name: 'No recorded runs' })).toBeVisible();
});

test('synthetic playground answers with inspectable sources and abstains on conflicts', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Agent Playground' }).click();
  await page.getByRole('textbox', { name: 'Ask your workspace' }).fill('Who owns Atlas?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Atlas owner is Maya Chen.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Atlas project plan' })).toBeVisible();
  await page.getByRole('button', { name: 'atlas-plan', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ask your workspace' }).fill('What is Cedar budget?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByRole('alert')).toContainText('conflicting information');
  await expect(page.getByRole('heading', { name: 'Cedar budget meeting' })).toBeVisible();
});

test('evaluation results are inspectable, persisted, and deleted only after confirmation', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Evaluations', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Run label' }).fill('E2E baseline');
  await page.getByRole('button', { name: 'Run evaluation', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Experiment details' });
  await expect(details.getByText(/20\/20 tests/)).toBeVisible();
  await details.getByText('atlas-owner', { exact: true }).click();
  await expect(details.getByText('Atlas owner is Maya Chen.', { exact: true })).toBeVisible();
  await details.getByRole('button', { name: 'Close experiment details' }).click();
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Run History' }).click();
  await expect(page.getByRole('button', { name: 'Inspect E2E baseline' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete run history' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Inspect E2E baseline' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete run history' }).click();
  await page.getByRole('button', { name: 'Delete history', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No recorded runs' })).toBeVisible();
});
