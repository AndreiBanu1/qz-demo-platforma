import { defineConfig, devices } from '@playwright/test';
import { resolveTarget } from './tests/support/hosts';

const baseURL = resolveTarget(process.env.TARGET);

export default defineConfig({
  testDir: 'tests',
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
      testIgnore: ['tests/bug-catcher/**'],
    },
  ],
});
