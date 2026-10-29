import { generateTrips, getTrip, type Mode, type Trip } from '../../../shared/data'
import { flightRows, trainCoaches } from '../../../shared/seats'
import { cache, searchKey } from '../lib/cache'
import { prisma } from '../lib/db'
import { holds, seatKey } from '../lib/holds'

export const layoutFor = (trip: Trip, cls: string) =>
  trip.mode === 'flight' ? flightRows(trip, cls).flatMap((r) => r.seats) : trainCoaches(trip, cls).flatMap((c) => c.seats)

/** Seats sold in the database for these trips, grouped as "tripId|cls" → seat ids. */
async function soldSeats(tripIds: string[]) {
  const rows = await prisma.seatAssignment.findMany({ where: { tripId: { in: tripIds } }, select: { tripId: true, seatId: true, leg: { select: { cls: true } } } })
  const map = new Map<string, string[]>()
  for (const r of rows) {
    const k = `${r.tripId}|${r.leg.cls}`
    map.set(k, [...(map.get(k) ?? []), r.seatId])
  }
  return map
}

const SEARCH_TTL_MS = 30_000

/** Search results: the generated timetable, with availability reduced by real bookings. Cached until a booking changes them. */
export async function searchTrips(mode: Mode, from: string, to: string, date: string) {
  const key = searchKey(mode, from, to, date)
  const hit = await cache.get(key).catch(() => null)
  if (hit) return JSON.parse(hit) as Trip[]
  const result = await computeSearch(mode, from, to, date)
  await cache.set(key, JSON.stringify(result), SEARCH_TTL_MS).catch(() => undefined)
  return result
}

async function computeSearch(mode: Mode, from: string, to: string, date: string): Promise<Trip[]> {
  const trips = generateTrips(mode, from, to, date)
  if (!trips.length) return []
  const ids = trips.map((t) => t.id)
  const [sold, inventory] = await Promise.all([soldSeats(ids), prisma.tripInventory.findMany({ where: { tripId: { in: ids } } })])
  return trips.map((t) => ({
    ...t,
    tatkalLeft: Math.max(0, t.tatkalLeft - inventory.filter((i) => i.tripId === t.id).reduce((s, i) => s + i.tatkalUsed, 0)),
    classes: t.classes.map((c) => {
      const available = Math.max(0, c.available - (sold.get(`${t.id}|${c.code}`)?.length ?? 0))
      const queued = inventory.find((i) => i.tripId === t.id && i.cls === c.code)?.waitlistSeq ?? 0
      return { ...c, available, waitlist: available === 0 ? c.waitlist + queued : 0 }
    }),
  }))
}

/** Seats that can't be picked right now (sold in the database, or held by someone else in Redis), plus the ones that can. */
export async function unavailableSeats(tripId: string, cls: string, ownHoldId?: string) {
  const trip = getTrip(tripId)
  if (!trip) return null
  const layout = layoutFor(trip, cls).filter((s) => !s.taken)
  const [sold, owners] = await Promise.all([
    prisma.seatAssignment.findMany({ where: { tripId }, select: { seatId: true } }),
    holds.owners(layout.map((s) => seatKey(tripId, s.id))),
  ])
  const held = layout.filter((_, i) => owners[i] && owners[i] !== ownHoldId).map((s) => s.id)
  const soldIds = sold.map((s) => s.seatId)
  // `free` lets clients without the shared layout code (scripts, mobile apps) pick a seat directly.
  const free = layout.map((s) => s.id).filter((id) => !soldIds.includes(id) && !held.includes(id))
  return { sold: soldIds, held, free }
}
