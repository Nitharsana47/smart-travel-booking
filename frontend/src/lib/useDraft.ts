import { useMemo } from 'react'
import { legIsWaitlist } from '../../../shared/rules'
import { seatedCount, useBooking } from '../store/booking'
import { getTrip } from './data'
import { quote } from './pricing'
import { flightRows } from './seats'

/** The current booking draft with its trips and live price, or null if there's no booking in progress. */
export function useDraft() {
  const draft = useBooking((s) => s.draft)
  return useMemo(() => {
    if (!draft || draft.legs.length === 0) return null
    const trips = draft.legs.map((l) => getTrip(l.tripId))
    if (trips.some((t) => !t)) return null
    const legs = draft.legs.map((l, i) => {
      const trip = trips[i]!
      const seatExtras =
        trip.mode === 'flight'
          ? flightRows(trip, l.cls)
              .flatMap((r) => r.seats)
              .filter((s) => l.seats.includes(s.id))
              .reduce((sum, s) => sum + s.extra, 0)
          : 0
      return { ...l, trip, seatExtras, waitlist: legIsWaitlist(trip, l.cls, draft.quota) }
    })
    const seated = seatedCount(draft)
    // Same pricing code as the server, so the total shown is the total charged.
    const q = quote({ legs, seated, infants: draft.infants, petSize: draft.petSize, fareType: draft.fareType, quota: draft.quota, coupon: draft.coupon })
    const seatsDone = legs.every((l) => l.waitlist || l.seats.length === seated)
    return { draft, legs, seated, quote: q, seatsDone, mode: legs[0].trip.mode }
  }, [draft])
}
