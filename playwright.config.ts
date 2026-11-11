import { defineConfig, devices } from '@playwright/test';
import { resolveTarget } from './tests/support/hosts';

const baseURL = resolveTarget(process.env.TARGET);

export default defineConfig({
  testDir: 'tests',
  globalSetup: './tests/support/global-setup.ts',
  webServer: {
    command: 'npm run start:test',
    url: 'http://127.0.0.1:8787/__demo/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: baseURL.href,
    extraHTTPHeaders: { Origin: baseURL.origin },
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/tests/unit/**', '**/tests/worker/**', '**/tests/bug-catcher/**'],
    },
    {
      name: 'iphone-15',
      // The device preset defaults to WebKit; the project runs on Chromium.
      use: { ...devices['iPhone 15'], browserName: 'chromium' },
      testMatch: ['**/tests/e2e/**/*.spec.ts', '**/tests/a11y/**/*.spec.ts'],
    },
    {
      // Reruns each catching check with one planted bug on; every test is an expected failure.
      name: 'bug-catcher',
      testDir: 'tests/bug-catcher',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
