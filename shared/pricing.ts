import { FARE_TYPES, type FareType, type PetSize, type Quota, type Trip } from './data'
import { evaluateCoupon } from './offers'

export interface QuoteLeg {
  trip: Trip
  cls: string
  seatExtras: number
  bin: boolean
}

export interface QuoteInput {
  legs: QuoteLeg[]
  seated: number // adults + children
  infants: number
  petSize: PetSize | null
  fareType: FareType
  quota: Quota
  coupon: string | null
}

export interface Quote {
  lines: { label: string; amount: number }[]
  taxes: number
  total: number
  couponError?: string
}

const round10 = (n: number) => Math.round(n / 10) * 10

/** Pet fare grows with size and distance. Flights cost more because bigger pets need the hold. */
export function petFare(trip: Trip, size: PetSize) {
  const table =
    trip.mode === 'flight'
      ? { small: [1500, 0.6], medium: [2500, 1.0], large: [3500, 1.4] }
      : { small: [400, 0.25], medium: [650, 0.35], large: [900, 0.5] }
  const [base, perKm] = table[size]
  return round10(base + trip.km * perKm)
}

export const BIN_FEE = 300
export const TATKAL_RATE = 0.3 // Tatkal costs 30% more than the base fare
export const INFANT_FLIGHT_FEE = 1750 // lap infants: flat fee per flight, free on trains

export function quote({ legs, seated, infants, petSize, fareType, quota, coupon }: QuoteInput): Quote {
  const lines: Quote['lines'] = []
  const round = legs.length > 1
  let base = 0
  let pet = 0

  legs.forEach((leg, i) => {
    const { trip } = leg
    const fareClass = trip.classes.find((c) => c.code === leg.cls)
    const legBase = (fareClass?.price ?? 0) * seated
    const prefix = round ? (i === 0 ? 'Outbound · ' : 'Return · ') : ''
    base += legBase
    lines.push({ label: `${prefix}${seated} × ${fareClass?.name ?? leg.cls}`, amount: legBase })
    if (trip.mode === 'train' && quota === 'TQ') lines.push({ label: `${prefix}Tatkal premium`, amount: round10(legBase * TATKAL_RATE) })
    if (leg.seatExtras) lines.push({ label: `${prefix}Seat upgrades`, amount: leg.seatExtras })
    if (leg.bin) lines.push({ label: `${prefix}Overhead bin`, amount: BIN_FEE * seated })
    if (infants && trip.mode === 'flight') lines.push({ label: `${prefix}${infants} × Lap infant`, amount: INFANT_FLIGHT_FEE * infants })
    if (petSize) {
      const p = petFare(trip, petSize)
      pet += p
      lines.push({ label: `${prefix}Pet fare`, amount: p })
    }
  })

  const mode = legs[0]?.trip.mode ?? 'flight'
  const special = mode === 'flight' ? FARE_TYPES[fareType].discount : 0
  if (special) {
    const off = Math.round(base * special)
    base -= off
    lines.push({ label: `${FARE_TYPES[fareType].label} fare discount`, amount: -off })
  }

  let couponError: string | undefined
  if (coupon) {
    const intl = legs.some((l) => l.trip.from.intl || l.trip.to.intl)
    const res = evaluateCoupon(coupon, { mode, legs: legs.length, intl, base, petFare: pet })
    if (res.error) couponError = res.error
    else lines.push({ label: `Coupon ${coupon.toUpperCase()}`, amount: -res.discount })
  }

  const subtotal = Math.max(0, lines.reduce((s, l) => s + l.amount, 0))
  const taxes = Math.round(subtotal * 0.05)
  return { lines, taxes, total: subtotal + taxes, couponError }
}
