import { createHash, randomBytes } from 'node:crypto'
import type { User } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { ACCESS_TTL, config, REFRESH_DAYS } from '../config'
import { HttpError, prisma } from '../lib/db'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role })

export const signAccess = (u: Pick<User, 'id' | 'role' | 'name'>) => jwt.sign({ role: u.role, name: u.name }, config.JWT_ACCESS_SECRET, { subject: u.id, expiresIn: ACCESS_TTL })

/** Issues a new opaque refresh token. Only its hash is stored, so a database leak can't be replayed. */
export async function issueRefresh(userId: string) {
  const token = randomBytes(48).toString('base64url')
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 864e5)
  await prisma.refreshToken.create({ data: { userId, tokenHash: sha256(token), expiresAt } })
  return { token, expiresAt }
}

/** An old token reused this soon after rotation is a race (quick reload, two tabs), not theft. */
export const REUSE_GRACE_MS = 30_000

/**
 * Rotation: every refresh revokes the old token and issues a new one.
 * If a revoked token shows up again after the grace window, it has probably
 * been stolen, so every session of that user is revoked.
 */
export async function rotateRefresh(token: string) {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } })
  if (!row) throw new HttpError(401, 'Session expired')
  if (row.revokedAt) {
    // Only rotation grants the grace window; tokens killed by logout or theft detection have no rotatedAt.
    if (row.rotatedAt && Date.now() - row.rotatedAt.getTime() < REUSE_GRACE_MS && row.expiresAt > new Date()) {
      return { user: row.user, refresh: await issueRefresh(row.userId) }
    }
    // Theft: revoke every session and switch off the grace window for all of this user's tokens.
    await prisma.$transaction([
      prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: row.userId }, data: { rotatedAt: null } }),
    ])
    throw new HttpError(401, 'Session expired')
  }
  if (row.expiresAt < new Date()) throw new HttpError(401, 'Session expired')
  const now = new Date()
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: now, rotatedAt: now } })
  return { user: row.user, refresh: await issueRefresh(row.userId) }
}

export async function revokeRefresh(token: string) {
  // Logout: revoke, and clear rotatedAt so a quick reuse can't slip in through the grace window.
  await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date(), rotatedAt: null } })
}
