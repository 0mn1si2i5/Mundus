import { defineConfig, devices } from '@playwright/test';

const configuredUrl = process.env.MUNDUS_LIVE_URL;
if (!configuredUrl) throw new Error('MUNDUS_LIVE_URL is required.');
const baseURL = configuredUrl.endsWith('/')
  ? configuredUrl
  : `${configuredUrl}/`;

export default defineConfig({
  testDir: './tests/release',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL,
    locale: 'zh-CN',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'live-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'live-mobile', use: { ...devices['Pixel 7'] } },
  ],
});
