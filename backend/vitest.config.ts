import { defineConfig } from 'vitest/config'
import { TEST_DB } from './test/env'

// Tests run against their own database (skyvoyage_test) and Redis db 1,
// so they never touch development data.
export default defineConfig({
  test: {
    env: { DATABASE_URL: TEST_DB, REDIS_URL: 'redis://127.0.0.1:6379/1', NODE_ENV: 'test', ADMIN_EMAIL: 'admin@test.dev' },
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
