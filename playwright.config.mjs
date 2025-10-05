import { defineConfig, devices } from '@playwright/test'

/* global process */

const baseURL = 'http://127.0.0.1:8080/'

export default defineConfig({
  testDir: 'playwright/tests',
  fullyParallel: true,
  reporter: process.env.CI
    ? [['html', { outputFolder: './reports/playwright' }], 'github']
    : [['html', { outputFolder: './reports/playwright' }]],
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    viewport: { width: 500, height: 600 },
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run start:test',
    url: baseURL,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 500, height: 600 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 500, height: 600 },
      },
    },
    {
      name: 'edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        viewport: { width: 500, height: 600 },
      },
    },
  ],
})
