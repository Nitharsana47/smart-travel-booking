import { randomInt } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { getTrip, type FareType, type Mode, type PetSize, type Quota, type Trip } from '../../../shared/data'
import { quote, type Quote } from '../../../shared/pricing'
import { checkLegSeats, legIsWaitlist, validateTravellers, type Contact, type Passenger, type PetInfo } from '../../../shared/rules'
import { invalidateTrips } from '../lib/cache'
import { HttpError, prisma, rupeesToPaise, todayIST } from '../lib/db'
import { holds, seatKey } from '../lib/holds'
import { layoutFor } from './inventory'

type Tx = Prisma.TransactionClient

// Under bursts a transaction may wait for a pooled connection; give it room instead of failing at the 2 s / 5 s defaults.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 }

export interface CreateBookingInput {
  holdId: string | null
  legs: { tripId: string; cls: string; seats: string[]; bin: boolean }[]
  passengers: Passenger[]
  petSize: PetSize | null
  pet: PetInfo | null
  fareType: FareType
  quota: Quota
  coupon: string | null
  contact: Contact
  payment: { method: 'card' | 'upi'; ref: string }
}

const BOOKING_INCLUDE = {
  legs: { orderBy: { position: 'asc' }, include: { seats: true } },
  passengers: { orderBy: { position: 'asc' } },
  pet: true,
  payment: true,
} satisfies Prisma.BookingInclude

type BookingRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>

/** The JSON shape the frontend uses for a booking. Seats are listed in passenger order. */
export function toDto(b: BookingRow) {
  return {
    pnr: b.pnr,
    createdAt: b.createdAt.getTime(),
    mode: b.mode,
    legs: b.legs.map((l) => ({
      trip: l.trip as unknown as Trip,
      cls: l.cls,
      bin: l.bin,
      status: l.status,
      waitlistNo: l.waitlistNo ?? undefined,
      seats: [...l.seats].sort((x, y) => x.position - y.position).map((s) => s.seatId),
    })),
    passengers: b.passengers.map((p) => ({ type: p.type, name: p.name, age: p.age, gender: p.gender })),
    petSize: b.petSize,
    pet: b.pet ? { name: b.pet.name, type: b.pet.type, breed: b.pet.breed, weightKg: b.pet.weightKg, vaccinatedOn: b.pet.vaccinatedOn } : null,
    fareType: b.fareType,
    quota: b.quota,
    quote: b.quote as unknown as Quote,
    payment: { method: b.payment?.method ?? 'card', ref: b.payment?.ref ?? '', status: b.payment?.status ?? 'CAPTURED' },
    contact: b.contact,
  }
}

function makePnr(mode: Mode) {
  if (mode === 'train') return Array.from({ length: 10 }, () => randomInt(10)).join('')
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O or 1/I
  return Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join('')
}

/** Lock the counters row for a trip + class until the transaction ends, creating it on first use. */
async function lockInventory(tx: Tx, tripId: string, cls: string) {
  await tx.$executeRaw`INSERT INTO "TripInventory" ("tripId", "cls") VALUES (${tripId}, ${cls}) ON CONFLICT DO NOTHING`
  const [row] = await tx.$queryRaw<{ waitlistSeq: number; tatkalUsed: number }[]>`
    SELECT "waitlistSeq", "tatkalUsed" FROM "TripInventory" WHERE "tripId" = ${tripId} AND "cls" = ${cls} FOR UPDATE`
  return row
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

/**
 * Creates a paid booking. Steps:
 * 1. Same Idempotency-Key as an earlier request → return that booking (no double charge).
 * 2. Re-validate everything on the server with the shared rules; recompute the price.
 * 3. Check the caller still owns the Redis hold on every seat.
 * 4. One transaction: lock inventory rows, assign waitlist numbers, insert the booking.
 *    The UNIQUE(tripId, seatId) constraint is the final guard against double booking.
 * 5. Release the Redis hold.
 */
export async function createBooking(userId: string, idempotencyKey: string, input: CreateBookingInput, db: PrismaClient = prisma) {
  const existing = await db.payment.findUnique({ where: { idempotencyKey }, include: { booking: { include: BOOKING_INCLUDE } } })
  if (existing) {
    if (existing.booking.userId !== userId) throw new HttpError(409, 'Idempotency key already used')
    return { booking: toDto(existing.booking), replayed: true }
  }

  const today = todayIST()
  const trips = input.legs.map((l) => getTrip(l.tripId))
  if (trips.some((t) => !t)) throw new HttpError(404, 'Trip not found')
  const legs = input.legs.map((l, i) => ({ ...l, trip: trips[i]!, waitlist: legIsWaitlist(trips[i]!, l.cls, input.quota) }))
  const mode = legs[0].trip.mode
  if (legs.some((l) => l.trip.mode !== mode)) throw new HttpError(400, 'All legs must use the same mode')
  if (legs.some((l) => l.trip.date < today)) throw new HttpError(400, 'This trip has already departed')
  if (legs.length === 2 && (legs[1].trip.from.code !== legs[0].trip.to.code || legs[1].trip.date < legs[0].trip.date)) throw new HttpError(400, 'The return leg must start where the outbound ends, on or after its date')

  const errors = validateTravellers(input.passengers, input.petSize ? input.pet : null, input.petSize, input.contact, { mode, quota: input.quota, fare: input.fareType }, today)
  if (Object.keys(errors).length) throw new HttpError(422, 'Please check the traveller details', errors)
  const seated = input.passengers.filter((p) => p.type !== 'Infant').length
  const infants = input.passengers.length - seated

  for (const l of legs) {
    if (l.waitlist) {
      if (l.seats.length) throw new HttpError(400, 'Waitlisted legs get seats only when confirmed')
      continue
    }
    const problem = checkLegSeats(l.trip, l.cls, l.seats, seated, input.petSize)
    if (problem) throw new HttpError(400, problem)
  }

  // The hold must still belong to this user and cover every seat.
  const heldKeys = legs.flatMap((l) => l.seats.map((s) => seatKey(l.trip.id, s)))
  if (heldKeys.length) {
    const meta = input.holdId ? await holds.getMeta(input.holdId) : null
    const owners = await holds.owners(heldKeys)
    if (!meta || meta.userId !== userId || owners.some((o) => o !== input.holdId)) throw new HttpError(409, 'Your seat hold expired. Please choose seats again.')
  }

  // Price is always recomputed here; the client's number is never trusted.
  const priced = quote({
    legs: legs.map((l) => ({ trip: l.trip, cls: l.cls, bin: l.bin && mode === 'flight', seatExtras: layoutFor(l.trip, l.cls).filter((s) => l.seats.includes(s.id)).reduce((a, s) => a + s.extra, 0) })),
    seated,
    infants,
    petSize: input.petSize,
    fareType: input.fareType,
    quota: input.quota,
    coupon: input.coupon,
  })
  if (input.coupon && priced.couponError) throw new HttpError(400, priced.couponError)

  for (let attempt = 0; ; attempt++) {
    try {
      const row = await db.$transaction(async (tx) => {
        const legRows = []
        for (const [position, l] of legs.entries()) {
          const inv = await lockInventory(tx, l.trip.id, l.cls)
          let waitlistNo: number | null = null
          if (l.waitlist) {
            const seq = inv.waitlistSeq + 1
            await tx.tripInventory.update({ where: { tripId_cls: { tripId: l.trip.id, cls: l.cls } }, data: { waitlistSeq: seq } })
            waitlistNo = (l.trip.classes.find((c) => c.code === l.cls)?.waitlist ?? 0) + seq
          } else if (input.quota === 'TQ' && mode === 'train') {
            if (inv.tatkalUsed + seated > l.trip.tatkalLeft) throw new HttpError(409, 'The Tatkal quota just sold out')
            await tx.tripInventory.update({ where: { tripId_cls: { tripId: l.trip.id, cls: l.cls } }, data: { tatkalUsed: { increment: seated } } })
          }
          legRows.push({ position, l, waitlistNo })
        }

        const booking = await tx.booking.create({
          data: {
            pnr: makePnr(mode),
            userId,
            mode,
            fareType: input.fareType,
            quota: input.quota,
            petSize: input.petSize,
            coupon: input.coupon?.toUpperCase() ?? null,
            contact: input.contact as unknown as Prisma.InputJsonValue,
            quote: priced as unknown as Prisma.InputJsonValue,
            totalPaise: rupeesToPaise(priced.total),
            passengers: { create: input.passengers.map((p, position) => ({ position, type: p.type, name: p.name.trim(), age: Number(p.age), gender: p.gender })) },
            pet: input.petSize && input.pet ? { create: { name: input.pet.name.trim(), type: input.pet.type, breed: input.pet.breed.trim(), weightKg: Number(input.pet.weightKg), vaccinatedOn: input.pet.vaccinatedOn, size: input.petSize } } : undefined,
            payment: { create: { idempotencyKey, method: input.payment.method, ref: input.payment.ref, amountPaise: rupeesToPaise(priced.total) } },
            legs: {
              create: legRows.map(({ position, l, waitlistNo }) => ({
                position,
                tripId: l.trip.id,
                cls: l.cls,
                bin: l.bin && mode === 'flight',
                status: l.waitlist ? 'WAITLIST' : 'CONFIRMED',
                waitlistNo,
                trip: l.trip as unknown as Prisma.InputJsonValue,
                seats: { create: l.seats.map((seatId, position) => ({ tripId: l.trip.id, seatId, position })) },
              })),
            },
          },
          include: BOOKING_INCLUDE,
        })
        return booking
      }, TX_OPTIONS)
      if (input.holdId) await holds.release(heldKeys, input.holdId)
      await invalidateTrips(legs.map((l) => l.trip.id))
      return { booking: toDto(row), replayed: false }
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      const target = String((e as Prisma.PrismaClientKnownRequestError).meta?.target ?? '')
      if (target.includes('seatId')) throw new HttpError(409, 'One of your seats was just booked by someone else')
      if (target.includes('idempotencyKey')) return createBooking(userId, idempotencyKey, input, db) // a parallel retry won the race
      if (target.includes('pnr') && attempt < 3) continue // astronomically rare PNR clash: try a new one
      throw e
    }
  }
}

/**
 * Cancels every leg of a booking in one transaction. Freed seats go to the
 * oldest waitlisted bookings on the same trip and class that fit, exactly
 * like handle_cancellation() in the original PHP version.
 */
export async function cancelBooking(userId: string, role: string, pnr: string) {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { pnr }, include: BOOKING_INCLUDE })
    if (!booking || (booking.userId !== userId && role !== 'ADMIN')) throw new HttpError(404, 'Booking not found')
    if (booking.legs.every((l) => l.status === 'CANCELLED')) throw new HttpError(409, 'Already cancelled')

    const promoted = new Set<string>()
    const wasConfirmed = booking.legs.some((l) => l.status === 'CONFIRMED')
    for (const leg of booking.legs) {
      if (leg.status === 'CANCELLED') continue
      await lockInventory(tx, leg.tripId, leg.cls)
      let freed = leg.status === 'CONFIRMED' ? [...leg.seats].sort((x, y) => x.position - y.position).map((s) => s.seatId) : []
      await tx.seatAssignment.deleteMany({ where: { legId: leg.id } })
      await tx.bookingLeg.update({ where: { id: leg.id }, data: { status: 'CANCELLED', waitlistNo: null } })

      const queue = await tx.bookingLeg.findMany({
        where: { tripId: leg.tripId, cls: leg.cls, status: 'WAITLIST' },
        orderBy: { waitlistNo: 'asc' },
        include: { booking: { select: { pnr: true, passengers: { select: { type: true } } } } },
      })
      for (const w of queue) {
        const need = w.booking.passengers.filter((p) => p.type !== 'Infant').length
        if (need > freed.length) continue
        await tx.seatAssignment.createMany({ data: freed.slice(0, need).map((seatId, position) => ({ legId: w.id, tripId: w.tripId, seatId, position })) })
        await tx.bookingLeg.update({ where: { id: w.id }, data: { status: 'CONFIRMED', waitlistNo: null } })
        freed = freed.slice(need)
        promoted.add(w.booking.pnr)
      }
    }

    const refundPaise = wasConfirmed ? Math.round(booking.totalPaise * 0.85) : booking.totalPaise
    await tx.payment.update({ where: { bookingId: booking.id }, data: { status: 'REFUNDED' } })
    const updated = await tx.booking.findUniqueOrThrow({ where: { id: booking.id }, include: BOOKING_INCLUDE })
    return { booking: toDto(updated), refund: refundPaise / 100, promoted: [...promoted] }
  }, TX_OPTIONS)
  await invalidateTrips(result.booking.legs.map((l) => l.trip.id))
  return result
}

export const findBooking = (pnr: string) => prisma.booking.findUnique({ where: { pnr }, include: BOOKING_INCLUDE })
export const listBookings = (userId: string) => prisma.booking.findMany({ where: { userId }, include: BOOKING_INCLUDE, orderBy: { createdAt: 'desc' } })
