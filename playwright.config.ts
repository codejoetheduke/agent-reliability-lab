import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:1420',
    browserName: 'chromium',
    channel: 'msedge',
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/dev.mjs web',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
