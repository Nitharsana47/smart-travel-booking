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
app.use(helmet())
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

// Every error ends up here and becomes { error, details? } with the right status code.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid request', details: err.flatten().fieldErrors })
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details })
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Malformed JSON' })
  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
})
