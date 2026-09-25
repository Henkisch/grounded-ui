import { defineConfig, devices } from '@playwright/test';

// Self-conformance: Grounded UI's own fixtures against Grounded UI's own contracts, in all three engines.
export default defineConfig({
  testDir: './test',
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
