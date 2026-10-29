import { defineConfig } from '@playwright/test'

// End-to-end tests drive a real Chrome through the whole app.
// The backend must be running (cd ../backend && npm run dev); the frontend dev server is started automatically.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // Generous waits and one retry: Docker Desktop on Windows can briefly stall new database connections.
  expect: { timeout: 15_000 },
  retries: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome', // use the installed Google Chrome, no browser download needed
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
