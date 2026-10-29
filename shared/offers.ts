import type { Mode } from './data'

export interface Offer {
  code: string
  title: string
  text: string
  terms: string
  img: string
  tag: string
  mode?: Mode
}

export const OFFERS: Offer[] = [
  { code: 'FLYHIGH', title: '12% off flights', text: 'Save up to ₹1,500 on any domestic or international flight.', terms: 'Minimum base fare ₹3,000. Discount capped at ₹1,500.', img: '/images/wing.jpg', tag: 'Flights', mode: 'flight' },
  { code: 'PAWSOME', title: '50% off pet fares', text: 'Bring your dog or cat along for half the pet fare.', terms: 'Valid on any booking with a pet. Applies to the pet fare only.', img: '/images/pet-dog.jpg', tag: 'Pets' },
  { code: 'RAILJOY', title: 'Flat ₹150 off trains', text: 'Scenic routes, sleeper berths and the pet coach, for less.', terms: 'Train bookings with a base fare of ₹1,000 or more.', img: '/images/train-scenic.jpg', tag: 'Trains', mode: 'train' },
  { code: 'ROUNDTRIP', title: 'Extra 8% on round trips', text: 'Book there and back together and save up to ₹2,500.', terms: 'Round-trip bookings only. Discount capped at ₹2,500.', img: '/images/goa.jpg', tag: 'Round trip' },
  { code: 'GOINTL', title: '₹3,000 off abroad', text: 'Dubai, Bali, the Maldives, Zurich, Singapore or Santorini.', terms: 'International flights with a base fare of ₹20,000 or more.', img: '/images/hero/maldives.jpg', tag: 'International', mode: 'flight' },
]

export interface CouponContext {
  mode: Mode
  legs: number
  intl: boolean
  base: number // base fare after special-fare discounts
  petFare: number
}

/** Returns the discount for a coupon, or an error explaining why it doesn't apply. */
export function evaluateCoupon(code: string, c: CouponContext): { discount: number; error?: string } {
  const fail = (error: string) => ({ discount: 0, error })
  switch (code.trim().toUpperCase()) {
    case 'FLYHIGH':
      if (c.mode !== 'flight') return fail('FLYHIGH is for flights only')
      if (c.base < 3000) return fail('Needs a base fare of ₹3,000 or more')
      return { discount: Math.min(1500, Math.round(c.base * 0.12)) }
    case 'PAWSOME':
      if (!c.petFare) return fail('Add a pet to your trip to use PAWSOME')
      return { discount: Math.round(c.petFare / 2) }
    case 'RAILJOY':
      if (c.mode !== 'train') return fail('RAILJOY is for trains only')
      if (c.base < 1000) return fail('Needs a base fare of ₹1,000 or more')
      return { discount: 150 }
    case 'ROUNDTRIP':
      if (c.legs < 2) return fail('ROUNDTRIP needs a round-trip booking')
      return { discount: Math.min(2500, Math.round(c.base * 0.08)) }
    case 'GOINTL':
      if (!c.intl) return fail('GOINTL is for international flights')
      if (c.base < 20000) return fail('Needs a base fare of ₹20,000 or more')
      return { discount: 3000 }
    default:
      return fail("That code isn't valid")
  }
}
