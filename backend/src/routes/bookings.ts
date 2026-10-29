import { Router } from 'express'
import { z } from 'zod'
import { FARE_TYPES, PET_SIZES, QUOTAS, type FareType, type PetSize, type Quota } from '../../../shared/data'
import { OFFERS } from '../../../shared/offers'
import { HttpError } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { cancelBooking, createBooking, findBooking, listBookings, toDto } from '../services/bookings'

export const bookingsRouter = Router()

const keysOf = <T extends string>(o: Record<T, unknown>) => Object.keys(o) as [T, ...T[]]

const Passenger = z.object({
  type: z.enum(['Adult', 'Child', 'Infant']),
  name: z.string().max(80),
  age: z.union([z.number().int().min(0).max(120), z.literal('')]),
  gender: z.enum(['', 'Female', 'Male', 'Other']),
})

const CreateBooking = z.object({
  holdId: z.string().uuid().nullable(),
  legs: z.array(z.object({ tripId: z.string().max(80), cls: z.string().max(4), seats: z.array(z.string().max(12)).max(9), bin: z.boolean() })).min(1).max(2),
  passengers: z.array(Passenger).min(1).max(18),
  petSize: z.enum(keysOf<PetSize>(PET_SIZES)).nullable(),
  pet: z.object({ name: z.string().max(40), type: z.enum(['Dog', 'Cat', 'Other']), breed: z.string().max(60), weightKg: z.union([z.number().positive().max(90), z.literal('')]), vaccinatedOn: z.string().max(10) }).nullable(),
  fareType: z.enum(keysOf<FareType>(FARE_TYPES)),
  quota: z.enum(keysOf<Quota>(QUOTAS)),
  coupon: z.string().max(20).nullable(),
  contact: z.object({ email: z.string().max(120), phone: z.string().max(10) }),
  payment: z.object({ method: z.enum(['card', 'upi']), ref: z.string().max(60) }),
})

bookingsRouter.post('/bookings', requireAuth, async (req, res) => {
  const key = req.header('Idempotency-Key')
  if (!key || key.length < 8 || key.length > 100) throw new HttpError(400, 'Idempotency-Key header is required')
  const { booking, replayed } = await createBooking(req.user!.id, key, CreateBooking.parse(req.body))
  res.status(replayed ? 200 : 201).json({ booking })
})

bookingsRouter.get('/bookings', requireAuth, async (req, res) => {
  res.json({ bookings: (await listBookings(req.user!.id)).map(toDto) })
})

bookingsRouter.get('/bookings/:pnr', requireAuth, async (req, res) => {
  const b = await findBooking(String(req.params.pnr).toUpperCase())
  if (!b || (b.userId !== req.user!.id && req.user!.role !== 'ADMIN')) throw new HttpError(404, 'Booking not found')
  res.json({ booking: toDto(b) })
})

bookingsRouter.post('/bookings/:pnr/cancel', requireAuth, async (req, res) => {
  res.json(await cancelBooking(req.user!.id, req.user!.role, String(req.params.pnr).toUpperCase()))
})

/** Public PNR status: journey and status only, no names or contact details. */
bookingsRouter.get('/pnr/:pnr', async (req, res) => {
  const b = await findBooking(req.params.pnr.trim().toUpperCase())
  if (!b) throw new HttpError(404, 'No booking found with this PNR')
  const dto = toDto(b)
  res.json({
    pnr: dto.pnr,
    mode: dto.mode,
    legs: dto.legs.map((l) => ({ operator: l.trip.operator, number: l.trip.number, date: l.trip.date, from: l.trip.from.code, to: l.trip.to.code, status: l.status, waitlistNo: l.waitlistNo, seats: l.seats })),
  })
})

bookingsRouter.get('/offers', (_req, res) => {
  res.json({ offers: OFFERS })
})
