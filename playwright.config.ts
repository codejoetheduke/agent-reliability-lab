import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:1420',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'msedge',
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    env: {
      LAB_DATA_DIR: path.resolve('.local', `e2e-${process.pid}-${Date.now()}`),
      LAB_CREDENTIALS_FILE: '',
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      NOTION_API_KEY: '',
      NOTION_ROOT_PAGE_IDS: '',
      LAB_DEFAULT_PROVIDER: 'mock',
    },
    command: 'node scripts/dev.mjs web',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
