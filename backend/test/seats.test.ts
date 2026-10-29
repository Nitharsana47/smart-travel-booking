import { describe, expect, it } from 'vitest'
import { addDaysISO, generateTrips } from '../../shared/data'
import { flightRows, trainCoaches } from '../../shared/seats'

// Browser and server must agree on which seats are free. Marking some seats as
// sold must only change those seats, never shift the generated occupancy of others.
describe('seat layouts', () => {
  const date = addDaysISO('2026-12-01', 3)

  it('marking flight seats as sold changes only those seats', () => {
    const trip = generateTrips('flight', 'BLR', 'GOI', date)[0]
    const base = flightRows(trip, 'ECO').flatMap((r) => r.seats)
    const sold = base.filter((s) => !s.taken).slice(0, 3).map((s) => s.id)
    const after = flightRows(trip, 'ECO', sold).flatMap((r) => r.seats)
    after.forEach((s, i) => expect(s.taken).toBe(base[i].taken || sold.includes(s.id)))
  })

  it('marking train berths as sold changes only those berths', () => {
    const trip = generateTrips('train', 'BLR', 'DEL', date)[0]
    const base = trainCoaches(trip, 'SL').flatMap((c) => c.seats)
    const sold = base.filter((s) => !s.taken).slice(0, 5).map((s) => s.id)
    const after = trainCoaches(trip, 'SL', sold).flatMap((c) => c.seats)
    after.forEach((s, i) => expect(s.taken).toBe(base[i].taken || sold.includes(s.id)))
  })
})
