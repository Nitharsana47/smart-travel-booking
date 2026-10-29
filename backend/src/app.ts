import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import cookieParser from 'cookie-parser'
import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import { ZodError } from 'zod'
import { HttpError, prisma } from './lib/db'
import { holdBackend } from './lib/holds'
import { adminRouter } from './routes/admin'
import { authRouter } from './routes/auth'
import { bookingsRouter } from './routes/bookings'
import { tripsRouter } from './routes/trips'

export const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Google Fonts for the typefaces; data:/blob: for QR codes and the ticket download.
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      },
    },
  }),
)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/api/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ ok: true, holds: holdBackend })
})
app.use('/api/auth', authRouter)
app.use('/api', tripsRouter)
app.use('/api', bookingsRouter)
app.use('/api/admin', adminRouter)

app.use('/api', (_req, _res) => {
  throw new HttpError(404, 'Not found')
})

// In production the API also serves the built website, so both share one domain
// (the login cookie then stays first-party). src/ and dist/ are both two levels below the repo root.
const site = fileURLToPath(new URL('../../frontend/dist', import.meta.url))
if (existsSync(site)) {
  app.use(express.static(site, { maxAge: '1h', index: false }))
  // Every other path is a page of the single-page app.
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile('index.html', { root: site }))
}

// Every error ends up here and becomes { error, details? } with the right status code.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid request', details: err.flatten().fieldErrors })
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details })
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Malformed JSON' })
  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
})
