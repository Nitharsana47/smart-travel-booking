// k6 load test for the SkyVoyage API.
//
// Run against a separate database (see loadtest/README.md), for example:
//   docker run --rm -i -e BASE_URL=http://host.docker.internal:4100 grafana/k6:0.57.0 run - < loadtest/booking.js
//
// Scenarios (run at the same time):
//   browse - up to 100 virtual users searching trips and opening seat maps
//   book   - up to 30 virtual users doing the full flow: search → seat map → hold → pay
//   race   - 50 virtual users try to grab the SAME seat at the same instant; exactly one may win
import http from 'k6/http'
import { check } from 'k6'
import { Counter } from 'k6/metrics'

const BASE = (__ENV.BASE_URL || 'http://host.docker.internal:4100') + '/api'
const ROUTES = [
  ['BLR', 'DEL'], ['DEL', 'BOM'], ['BOM', 'GOI'], ['MAA', 'HYD'], ['CCU', 'BLR'],
  ['HYD', 'PNQ'], ['AMD', 'JAI'], ['COK', 'BOM'], ['DEL', 'DXB'], ['BLR', 'SIN'],
]
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

const bookingsMade = new Counter('bookings_made')
const holdConflicts = new Counter('hold_conflicts') // 409: someone else got the seat first (expected under load)
const raceWins = new Counter('race_wins')

// 409 is a correct answer under contention, not a failure.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409))

export const options = {
  scenarios: {
    browse: { executor: 'ramping-vus', exec: 'browse', stages: [{ duration: '20s', target: 100 }, { duration: '40s', target: 100 }, { duration: '10s', target: 0 }] },
    book: { executor: 'ramping-vus', exec: 'book', stages: [{ duration: '20s', target: 30 }, { duration: '40s', target: 30 }, { duration: '10s', target: 0 }] },
    race: { executor: 'shared-iterations', exec: 'race', vus: 50, iterations: 50, startTime: '75s', maxDuration: '30s' },
  },
  thresholds: {
    'http_req_duration{name:search}': ['p(95)<500'],
    'http_req_duration{name:seats}': ['p(95)<500'],
    'http_req_duration{name:hold}': ['p(95)<800'],
    'http_req_duration{name:book}': ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
    race_wins: ['count==1'], // the double-booking check
    checks: ['rate>0.99'],
  },
}

const json = (token) => ({ headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })

/** Registers a few users (the signup rate limit is 20/minute) and picks the seat everyone will fight over. */
export function setup() {
  const stamp = Date.now()
  const tokens = []
  for (let i = 0; i < 10; i++) {
    const res = http.post(`${BASE}/auth/register`, JSON.stringify({ name: `Load User ${i}`, email: `load${i}+${stamp}@example.com`, phone: '9876543210', password: 'Travel2026!' }), { headers: { 'Content-Type': 'application/json' } })
    check(res, { 'registered': (r) => r.status === 201 })
    tokens.push(res.json('accessToken'))
  }
  const trips = http.get(`${BASE}/trips/search?mode=flight&from=BLR&to=GOI&date=${day(45)}`).json('trips')
  const raceTrip = trips[0].id
  const raceSeat = http.get(`${BASE}/trips/${encodeURIComponent(raceTrip)}/seats?cls=ECO`).json('free')[0]
  return { tokens, raceTrip, raceSeat }
}

export function browse() {
  const [from, to] = ROUTES[Math.floor(Math.random() * ROUTES.length)]
  const mode = from === 'DEL' && to === 'DXB' ? 'flight' : Math.random() < 0.6 ? 'flight' : 'train'
  const res = http.get(`${BASE}/trips/search?mode=${mode}&from=${from}&to=${to}&date=${day(10 + Math.floor(Math.random() * 30))}`, { tags: { name: 'search' } })
  check(res, { 'search ok': (r) => r.status === 200 })
  const trips = res.json('trips') || []
  if (trips.length) {
    const t = trips[Math.floor(Math.random() * trips.length)]
    const seats = http.get(`${BASE}/trips/${encodeURIComponent(t.id)}/seats?cls=${t.classes[0].code}`, { tags: { name: 'seats' } })
    check(seats, { 'seats ok': (r) => r.status === 200 })
  }
}

export function book(data) {
  const token = data.tokens[__VU % data.tokens.length]
  const [from, to] = ROUTES[Math.floor(Math.random() * ROUTES.length)]
  const trips = http.get(`${BASE}/trips/search?mode=flight&from=${from}&to=${to}&date=${day(15 + Math.floor(Math.random() * 40))}`, { tags: { name: 'search' } }).json('trips') || []
  const trip = trips.find((t) => t.classes[0].available > 0)
  if (!trip) return
  const free = http.get(`${BASE}/trips/${encodeURIComponent(trip.id)}/seats?cls=ECO`, { tags: { name: 'seats' } }).json('free') || []
  if (!free.length) return
  const seat = free[Math.floor(Math.random() * free.length)]

  const hold = http.post(`${BASE}/holds`, JSON.stringify({ legs: [{ tripId: trip.id, cls: 'ECO', seats: [seat] }], seated: 1, petSize: null }), { ...json(token), tags: { name: 'hold' } })
  if (hold.status === 409) return holdConflicts.add(1)
  check(hold, { 'hold ok': (r) => r.status === 201 })
  if (hold.status !== 201) return

  const body = {
    holdId: hold.json('holdId'),
    legs: [{ tripId: trip.id, cls: 'ECO', seats: [seat], bin: false }],
    passengers: [{ type: 'Adult', name: 'Load Tester', age: 30, gender: 'Female' }],
    petSize: null,
    pet: null,
    fareType: 'regular',
    quota: 'GN',
    coupon: null,
    contact: { email: 'load@example.com', phone: '9876543210' },
    payment: { method: 'card', ref: '•••• 1111' },
  }
  const params = json(token)
  params.headers['Idempotency-Key'] = `load-${__VU}-${__ITER}-${Date.now()}`
  params.tags = { name: 'book' }
  const res = http.post(`${BASE}/bookings`, JSON.stringify(body), params)
  if (res.status === 409) return holdConflicts.add(1)
  if (check(res, { 'booked': (r) => r.status === 201 })) bookingsMade.add(1)
}

/** Everyone wants the same seat at the same moment. Holds are atomic, so exactly one booking may succeed. */
export function race(data) {
  const token = data.tokens[__VU % data.tokens.length]
  const hold = http.post(`${BASE}/holds`, JSON.stringify({ legs: [{ tripId: data.raceTrip, cls: 'ECO', seats: [data.raceSeat] }], seated: 1, petSize: null }), { ...json(token), tags: { name: 'hold' } })
  check(hold, { 'race hold answered': (r) => r.status === 201 || r.status === 409 })
  if (hold.status !== 201) return
  const params = json(token)
  params.headers['Idempotency-Key'] = `race-${__VU}-${Date.now()}`
  params.tags = { name: 'book' }
  const res = http.post(
    `${BASE}/bookings`,
    JSON.stringify({ holdId: hold.json('holdId'), legs: [{ tripId: data.raceTrip, cls: 'ECO', seats: [data.raceSeat], bin: false }], passengers: [{ type: 'Adult', name: 'Race Tester', age: 30, gender: 'Female' }], petSize: null, pet: null, fareType: 'regular', quota: 'GN', coupon: null, contact: { email: 'race@example.com', phone: '9876543210' }, payment: { method: 'card', ref: '•••• 1111' } }),
    params,
  )
  if (res.status === 201) raceWins.add(1)
}
