import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { cityByCode, getTrip, PET_SIZES } from '../../../shared/data'
import { checkLegSeats } from '../../../shared/rules'
import { HOLD_MS } from '../config'
import { HttpError, prisma, todayIST } from '../lib/db'
import { holds, seatKey } from '../lib/holds'
import { requireAuth } from '../middleware/auth'
import { searchTrips, unavailableSeats } from '../services/inventory'

export const tripsRouter = Router()

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const Search = z.object({
  mode: z.enum(['flight', 'train']),
  from: z.string().refine((c) => !!cityByCode(c), 'Unknown city'),
  to: z.string().refine((c) => !!cityByCode(c), 'Unknown city'),
  date: ISO,
})

tripsRouter.get('/trips/search', async (req, res) => {
  const q = Search.parse(req.query)
  if (q.date < todayIST()) throw new HttpError(400, 'Date is in the past')
  res.json({ trips: await searchTrips(q.mode, q.from, q.to, q.date) })
})

tripsRouter.get('/trips/:id/seats', async (req, res) => {
  const cls = z.string().min(1).parse(req.query.cls)
  const result = await unavailableSeats(req.params.id, cls, typeof req.query.holdId === 'string' ? req.query.holdId : undefined)
  if (!result) throw new HttpError(404, 'Trip not found')
  res.json(result)
})

// ------------------------------------------------------------------ holds

const Hold = z.object({
  legs: z.array(z.object({ tripId: z.string(), cls: z.string(), seats: z.array(z.string()).max(9) })).min(1).max(2),
  seated: z.number().int().min(1).max(9),
  petSize: z.enum(Object.keys(PET_SIZES) as ['small', 'medium', 'large']).nullable(),
})

/**
 * Hold seats for 5 minutes. All seats across all legs are held atomically:
 * either every seat is reserved for this checkout, or none is and the
 * response lists the seats someone else got first.
 */
tripsRouter.post('/holds', requireAuth, async (req, res) => {
  const body = Hold.parse(req.body)
  const keys: string[] = []
  for (const leg of body.legs) {
    const trip = getTrip(leg.tripId)
    if (!trip) throw new HttpError(404, 'Trip not found')
    if (trip.date < todayIST()) throw new HttpError(400, 'This trip has already departed')
    const problem = checkLegSeats(trip, leg.cls, leg.seats, body.seated, body.petSize)
    if (problem) throw new HttpError(400, problem)
    keys.push(...leg.seats.map((s) => seatKey(trip.id, s)))
  }
  const sold = await prisma.seatAssignment.findMany({ where: { OR: body.legs.map((l) => ({ tripId: l.tripId, seatId: { in: l.seats } })) }, select: { seatId: true } })
  if (sold.length) throw new HttpError(409, 'Some seats were just booked', { seats: sold.map((s) => s.seatId) })

  const holdId = randomUUID()
  const result = await holds.acquire(keys, holdId, HOLD_MS)
  if (!result.ok) throw new HttpError(409, 'Someone else is holding some of these seats', { seats: result.conflicts.map((k) => k.split(':').pop()) })
  const expiresAt = Date.now() + HOLD_MS
  await holds.setMeta(holdId, { userId: req.user!.id, keys, expiresAt }, HOLD_MS)
  res.status(201).json({ holdId, expiresAt })
})

tripsRouter.delete('/holds/:id', requireAuth, async (req, res) => {
  const meta = await holds.getMeta(String(req.params.id))
  if (meta && meta.userId === req.user!.id) await holds.release(meta.keys, String(req.params.id))
  res.status(204).end()
})
