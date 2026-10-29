import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { HttpError } from '../lib/db'

export interface AuthUser {
  id: string
  role: 'USER' | 'ADMIN'
  name: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

/** Reads "Authorization: Bearer <access token>" and attaches req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new HttpError(401, 'Please sign in')
  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as jwt.JwtPayload
    req.user = { id: payload.sub!, role: payload.role, name: payload.name }
    next()
  } catch {
    throw new HttpError(401, 'Session expired')
  }
}

/** Role-based access control: only the listed roles may continue. Use after requireAuth. */
export const requireRole =
  (...roles: AuthUser['role'][]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw new HttpError(403, 'Not allowed')
    next()
  }
