import { defineConfig, devices } from '@playwright/test';

// Self-conformance: grund's own fixtures against grund's own contracts, in all three engines.
export default defineConfig({
  testDir: './test',
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
