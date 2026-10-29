import { rng, type Trip } from './data'

export type SeatTag = 'window' | 'middle' | 'aisle' | 'exit' | 'front' | 'pet'

export interface Seat {
  id: string
  label: string
  kind: string // "Window", "Lower berth", ...
  extra: number
  tags: SeatTag[]
  taken: boolean
  cabin?: number // train cabins (1A / pet coach)
}

export interface FlightRow {
  row: number
  exit: boolean
  seats: Seat[]
}

export interface Coach {
  id: string
  layout: 'bay8' | 'bay6' | 'cabin4'
  seats: Seat[]
}

/** Probability that a seat is already taken, derived from the class's availability. */
function occupancy(trip: Trip, cls: string) {
  const c = trip.classes.find((x) => x.code === cls)
  if (!c || c.total === 0) return 0.5
  // Capped so maps look like a busy service, not a sold-out one (and there is always something to pick).
  return Math.min(trip.mode === 'flight' ? 0.68 : 0.78, Math.max(0.15, 1 - c.available / c.total))
}

// ---------------------------------------------------------------- flights

export const FLIGHT_LETTERS = { ECO: ['A', 'B', 'C', 'D', 'E', 'F'], BUS: ['A', 'C', 'D', 'F'] } as const
const EXIT_ROWS = [14, 15]
const PET_ROWS = [27, 28, 29, 30]

export function flightRows(trip: Trip, cls: string, booked: string[] = []): FlightRow[] {
  const r = rng(trip.id + cls)
  const occ = occupancy(trip, cls)
  const business = cls === 'BUS'
  const letters = business ? FLIGHT_LETTERS.BUS : FLIGHT_LETTERS.ECO
  const rows: FlightRow[] = []
  const [first, last] = business ? [1, 3] : [4, 30]

  for (let row = first; row <= last; row++) {
    if (row === 13) continue // most airlines skip row 13
    const exit = EXIT_ROWS.includes(row)
    const seats = letters.map((letter, i): Seat => {
      const id = `${row}${letter}`
      const edge = i === 0 || i === letters.length - 1
      const aisle = business ? i === 1 || i === 2 : letter === 'C' || letter === 'D'
      const tags: SeatTag[] = [edge ? 'window' : aisle ? 'aisle' : 'middle']
      let extra = 0
      if (!business && row <= 5) {
        tags.push('front')
        extra = 350
      }
      if (exit) {
        tags.push('exit')
        extra = 450
      }
      if (!business && PET_ROWS.includes(row) && edge) tags.push('pet')
      return {
        id,
        label: id,
        kind: tags[0][0].toUpperCase() + tags[0].slice(1),
        extra,
        tags,
        // Draw the random number first, always: skipping it for sold seats would shift every seat after them.
        taken: r() < occ || booked.includes(id),
      }
    })
    rows.push({ row, exit, seats })
  }
  return rows
}

/** Overhead bin above a seat: rows share a bin per side, e.g. "14L". */
export const binFor = (seatId: string) => {
  const row = parseInt(seatId, 10)
  const letter = seatId.replace(/\d+/g, '')
  return `${row}${'ABC'.includes(letter) ? 'L' : 'R'}`
}

// ---------------------------------------------------------------- trains

const BAY8 = ['Lower', 'Middle', 'Upper', 'Lower', 'Middle', 'Upper', 'Side lower', 'Side upper']
const BAY6 = ['Lower', 'Upper', 'Lower', 'Upper', 'Side lower', 'Side upper']
const CABIN4 = ['Lower', 'Upper', 'Lower', 'Upper']

const COACHES: Record<string, { prefix: string; count: number; layout: Coach['layout']; size: number }> = {
  SL: { prefix: 'S', count: 3, layout: 'bay8', size: 72 },
  '3A': { prefix: 'B', count: 2, layout: 'bay8', size: 64 },
  '2A': { prefix: 'A', count: 1, layout: 'bay6', size: 48 },
  '1A': { prefix: 'H', count: 1, layout: 'cabin4', size: 24 },
  PT: { prefix: 'P', count: 1, layout: 'cabin4', size: 24 },
}

/** "Lower berth" → "LB", "Side upper berth" → "SU". */
export const berthShort = (kind: string) => {
  const words = kind.replace(' berth', '').split(' ')
  return words.map((w) => w[0].toUpperCase()).join('') + (words.length === 1 ? 'B' : '')
}

export function trainCoaches(trip: Trip, cls: string, booked: string[] = []): Coach[] {
  const spec = COACHES[cls]
  if (!spec) return []
  const r = rng(trip.id + cls)
  const occ = occupancy(trip, cls)
  const pattern = spec.layout === 'bay8' ? BAY8 : spec.layout === 'bay6' ? BAY6 : CABIN4

  return Array.from({ length: spec.count }, (_, c) => {
    const coachId = `${spec.prefix}${c + 1}`
    const seats = Array.from({ length: spec.size }, (_, i): Seat => {
      const n = i + 1
      const kind = pattern[i % pattern.length] + ' berth'
      const id = `${coachId}-${n}`
      return {
        id,
        label: `${n}`,
        kind,
        extra: 0,
        tags: [],
        taken: r() < occ || booked.includes(id), // random draw first, so sold seats don't shift the sequence
        cabin: spec.layout === 'cabin4' ? Math.floor(i / 4) + 1 : undefined,
      }
    })
    return { id: coachId, layout: spec.layout, seats }
  })
}

/**
 * Pet coach allocation: owners and their pet must share one cabin.
 * Best-fit picks the cabin whose free berths exceed the party size by the
 * smallest margin, so fully empty cabins stay free for bigger families.
 * Lower berths are filled first because they are easier with a pet.
 */
export function bestFitCabin(coach: Coach, party: number): Seat[] | null {
  const cabins = new Map<number, Seat[]>()
  for (const s of coach.seats) {
    if (s.cabin === undefined || s.taken) continue
    cabins.set(s.cabin, [...(cabins.get(s.cabin) ?? []), s])
  }
  let best: Seat[] | null = null
  for (const free of cabins.values()) {
    if (free.length < party) continue
    if (!best || free.length < best.length) best = free
  }
  if (!best) return null
  return [...best].sort((a, b) => Number(b.kind.startsWith('Lower')) - Number(a.kind.startsWith('Lower'))).slice(0, party)
}
