import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 90000,
  expect: { timeout: 12000 },
  workers: 1,
  reporter: 'list',
  webServer: process.env.BROWSERCEPTION_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    baseURL: process.env.BROWSERCEPTION_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
