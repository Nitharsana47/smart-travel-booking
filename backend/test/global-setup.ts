import { execSync } from 'node:child_process'
import { TEST_DB } from './env'

/** Creates the test database if needed and brings its schema up to date. */
export default function setup() {
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: TEST_DB } })
}
