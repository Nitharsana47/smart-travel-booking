import bcrypt from 'bcryptjs'
import { Router, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { EMAIL_RE, PHONE_RE } from '../../../shared/rules'
import { config, isProd } from '../config'
import { HttpError, prisma } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { issueRefresh, publicUser, revokeRefresh, rotateRefresh, signAccess } from '../services/auth'

export const authRouter = Router()

const COOKIE = 'sv_refresh'
const setRefreshCookie = (res: Response, token: string, expires: Date) =>
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/api/auth', expires })

// Slow down password guessing.
authRouter.use(['/login', '/register'], rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again in a minute' } }))

const Register = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().regex(EMAIL_RE, 'Invalid email'),
  phone: z.string().regex(PHONE_RE, 'Invalid mobile number'),
  password: z.string().min(8).max(128).regex(/\d/, 'Password needs a number').regex(/[a-z]/i, 'Password needs a letter'),
})

authRouter.post('/register', async (req, res) => {
  const body = Register.parse(req.body)
  if (await prisma.user.findUnique({ where: { email: body.email } })) throw new HttpError(409, 'An account with this email already exists. Try signing in.')
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      passwordHash: await bcrypt.hash(body.password, 12),
      role: config.ADMIN_EMAIL && body.email === config.ADMIN_EMAIL.toLowerCase() ? 'ADMIN' : 'USER',
    },
  })
  const refresh = await issueRefresh(user.id)
  setRefreshCookie(res, refresh.token, refresh.expiresAt)
  res.status(201).json({ user: publicUser(user), accessToken: signAccess(user) })
})

const Login = z.object({ email: z.string().trim().toLowerCase(), password: z.string() })

authRouter.post('/login', async (req, res) => {
  const { email, password } = Login.parse(req.body)
  const user = await prisma.user.findUnique({ where: { email } })
  // Same message for unknown email and wrong password, so accounts can't be probed.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Email or password is incorrect.')
  const refresh = await issueRefresh(user.id)
  setRefreshCookie(res, refresh.token, refresh.expiresAt)
  res.json({ user: publicUser(user), accessToken: signAccess(user) })
})

authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.[COOKIE]
  if (!token) throw new HttpError(401, 'Not signed in')
  const { user, refresh } = await rotateRefresh(token)
  setRefreshCookie(res, refresh.token, refresh.expiresAt)
  res.json({ user: publicUser(user), accessToken: signAccess(user) })
})

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[COOKIE]
  if (token) await revokeRefresh(token)
  res.clearCookie(COOKIE, { path: '/api/auth' })
  res.status(204).end()
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
  if (!user) throw new HttpError(404, 'User not found')
  res.json({ user: publicUser(user) })
})
