import { defineConfig } from '@playwright/test'

const configuredBaseUrl = process.env['PLAYWRIGHT_ADMIN_BASE_URL']
const baseURL = configuredBaseUrl ?? 'http://127.0.0.1:4173'
const base = new URL(baseURL)
const inCi = process.env['CI'] !== undefined

export default defineConfig({
  testDir: './tests/browser',
  outputDir: '.artifacts/playwright',
  fullyParallel: false,
  forbidOnly: inCi,
  retries: 0,
  workers: 1,
  reporter: 'line',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    serviceWorkers: 'block',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'off',
    video: 'off',
  },
  ...(configuredBaseUrl === undefined
    ? {
        webServer: {
          command: `./node_modules/.bin/vite --host ${base.hostname} --port ${base.port || '4173'}`,
          url: baseURL,
          reuseExistingServer: !inCi,
          timeout: 120_000,
        },
      }
    : {}),
  projects: [
    {
      name: 'live-capability-text',
      testMatch: '**/live/**/*.pw.ts',
      use: {
        screenshot: 'off',
        trace: 'off',
        video: 'off',
        acceptDownloads: false,
      },
    },
    {
      name: 'token-free-viewers',
      testMatch: '**/visual/**/*.pw.ts',
      use: {
        viewport: { width: 1280, height: 900 },
        screenshot: 'only-on-failure',
        trace: 'off',
        video: 'off',
        acceptDownloads: false,
      },
    },
  ],
})
