import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,

  // Fail the build on CI if tests are accidentally skipped with test.only.
  forbidOnly: !!process.env.CI,

  // Retry once on CI to reduce false negatives from WASM load timing.
  retries: process.env.CI ? 1 : 0,

  // Single worker on CI; auto-detect locally.
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:8080',
    // Capture a trace on the first retry so failures are diagnosable.
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to add browser coverage:
    // { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',   use: { ...devices['Desktop Safari'] }  },
  ],

  webServer: {
    // Serve the pre-built www/ directory.  Run `make build` before testing.
    command: 'python3 -m http.server 8080',
    cwd: path.join(__dirname, 'www'),
    url: 'http://localhost:8080',
    // In CI always start fresh; locally reuse an existing server if running.
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
