import 'dotenv/config'
import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().optional().default(''),
  PORT: z.coerce.number().default(4000),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  ADMIN_EMAIL: z.string().email().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

// Fail fast with a readable message if the environment is misconfigured.
const parsed = Env.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
export const isProd = config.NODE_ENV === 'production'

export const HOLD_MS = 5 * 60 * 1000
export const ACCESS_TTL = '15m'
export const REFRESH_DAYS = 7
