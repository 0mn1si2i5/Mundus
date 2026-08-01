import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // WebGL browser tests share a finite GPU context budget; run them serially so
  // capability-fallback coverage does not mask context lifecycle coverage.
  fullyParallel: false,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'zh-CN',
    trace: 'on-first-retry',
  },
  webServer: process.env.MUNDUS_E2E_EXTERNAL_SERVER
    ? undefined
    : {
        command: 'pnpm build && pnpm preview --host 127.0.0.1',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
