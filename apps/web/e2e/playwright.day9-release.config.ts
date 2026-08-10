import { defineConfig, devices } from '@playwright/test';

const e2eEnv = { ...process.env, BREAD_E2E: '1' } as Record<string, string>;

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: 'line',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'probe-firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'probe-webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'pnpm exec next dev --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 120_000,
    env: e2eEnv,
  },
});
