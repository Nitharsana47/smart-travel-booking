import { Router } from 'express'
import { prisma } from '../lib/db'
import { requireAuth, requireRole } from '../middleware/auth'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('ADMIN'))

/** Dashboard numbers. Revenue counts captured payments only (refunds excluded). */
adminRouter.get('/stats', async (_req, res) => {
  const [users, bookings, legs, payments, pets] = await Promise.all([
    prisma.user.count(),
    prisma.booking.count(),
    prisma.bookingLeg.groupBy({ by: ['status'], _count: true }),
    prisma.payment.groupBy({ by: ['status'], _sum: { amountPaise: true }, _count: true }),
    prisma.pet.groupBy({ by: ['size'], _count: true }),
  ])

  // Top routes by number of legs sold: tripId is "mode~FROM~TO~date~n".
  const recent = await prisma.bookingLeg.findMany({ select: { tripId: true, status: true }, orderBy: { id: 'desc' }, take: 2000 })
  const routes = new Map<string, number>()
  for (const l of recent) {
    if (l.status === 'CANCELLED') continue
    const [mode, from, to] = l.tripId.split('~')
    const k = `${mode}:${from}→${to}`
    routes.set(k, (routes.get(k) ?? 0) + 1)
  }

  res.json({
    users,
    bookings,
    legsByStatus: Object.fromEntries(legs.map((l) => [l.status, l._count])),
    revenue: (payments.find((p) => p.status === 'CAPTURED')?._sum.amountPaise ?? 0) / 100,
    refunded: (payments.find((p) => p.status === 'REFUNDED')?._sum.amountPaise ?? 0) / 100,
    petsBySize: Object.fromEntries(pets.map((p) => [p.size, p._count])),
    topRoutes: [...routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([route, count]) => ({ route, count })),
  })
})
