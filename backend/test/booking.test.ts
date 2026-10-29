import { randomUUID } from 'node:crypto'
import { Redis } from 'ioredis'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addDaysISO, generateTrips, type Trip } from '../../shared/data'
import { quote } from '../../shared/pricing'
import { flightRows, trainCoaches } from '../../shared/seats'
import { app } from '../src/app'
import { prisma, todayIST } from '../src/lib/db'
import { holds } from '../src/lib/holds'

const api = request(app)
const date = addDaysISO(todayIST(), 10)

async function signUp(name: string, email: string) {
  const res = await api.post('/api/auth/register').send({ name, email, phone: '9876543210', password: 'Travel2026!' })
  expect(res.status).toBe(201)
  return { token: res.body.accessToken as string, cookie: res.headers['set-cookie'] as unknown as string[] }
}

const adult = (name: string) => ({ type: 'Adult', name, age: 30, gender: 'Female' })
const contact = { email: 'a@example.com', phone: '9876543210' }

function bookingBody(trip: Trip, cls: string, seats: string[], holdId: string | null, passengers = [adult('Asha Rao')]) {
  return {
    holdId,
    legs: [{ tripId: trip.id, cls, seats, bin: false }],
    passengers,
    petSize: null,
    pet: null,
    fareType: 'regular',
    quota: 'GN',
    coupon: null,
    contact,
    payment: { method: 'card', ref: '•••• 1111' },
  }
}

let alice: { token: string; cookie: string[] }
let bob: { token: string; cookie: string[] }
let flight: Trip
let freeSeats: string[]

beforeAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "User", "TripInventory" RESTART IDENTITY CASCADE')
  // Holds from a previous run may still be alive (5-minute expiry): start from an empty test Redis.
  const redis = new Redis(process.env.REDIS_URL!)
  await redis.flushdb()
  await redis.quit()
  alice = await signUp('Alice Rao', 'alice@test.dev')
  bob = await signUp('Bob Iyer', 'bob@test.dev')
  flight = generateTrips('flight', 'BLR', 'DEL', date).find((t) => t.classes[0].available > 10)!
  freeSeats = flightRows(flight, 'ECO')
    .flatMap((r) => r.seats)
    .filter((s) => !s.taken && !s.extra)
    .map((s) => s.id)
})

afterAll(async () => {
  await prisma.$disconnect()
  await holds.close()
})

describe('auth', () => {
  it('rejects a wrong password with a generic message', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'alice@test.dev', password: 'nope-nope-1' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Email or password is incorrect.')
  })

  it('tolerates an immediate reuse of a rotated refresh token (quick reload, two tabs)', async () => {
    const first = await api.post('/api/auth/refresh').set('Cookie', bob.cookie)
    expect(first.status).toBe(200)
    const raced = await api.post('/api/auth/refresh').set('Cookie', bob.cookie)
    expect(raced.status).toBe(200)
  })

  it('does not let a logged-out refresh token back in, even right away', async () => {
    const carol = await signUp('Carol Das', 'carol@test.dev')
    expect((await api.post('/api/auth/logout').set('Cookie', carol.cookie)).status).toBe(204)
    expect((await api.post('/api/auth/refresh').set('Cookie', carol.cookie)).status).toBe(401)
  })

  it('treats reuse of an old refresh token as theft and revokes every session', async () => {
    const first = await api.post('/api/auth/refresh').set('Cookie', alice.cookie)
    expect(first.status).toBe(200)
    // Pretend the original token was rotated a minute ago, outside the grace window.
    await prisma.refreshToken.updateMany({ where: { user: { email: 'alice@test.dev' }, revokedAt: { not: null } }, data: { revokedAt: new Date(Date.now() - 60_000), rotatedAt: new Date(Date.now() - 60_000) } })
    const replay = await api.post('/api/auth/refresh').set('Cookie', alice.cookie)
    expect(replay.status).toBe(401)
    const second = await api.post('/api/auth/refresh').set('Cookie', first.headers['set-cookie'] as unknown as string[])
    expect(second.status).toBe(401)
  })

  it('blocks non-admins from admin routes', async () => {
    const res = await api.get('/api/admin/stats').set('Authorization', `Bearer ${bob.token}`)
    expect(res.status).toBe(403)
  })

  it('lets the configured admin email read dashboard stats', async () => {
    const admin = await signUp('Ada Admin', 'admin@test.dev')
    const res = await api.get('/api/admin/stats').set('Authorization', `Bearer ${admin.token}`)
    expect(res.status).toBe(200)
    expect(res.body.users).toBe(4) // alice, bob, carol, admin
  })
})

describe('seat holds', () => {
  it('gives a contested seat to exactly one of 20 simultaneous requests', async () => {
    const seat = freeSeats[0]
    const attempts = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        api
          .post('/api/holds')
          .set('Authorization', `Bearer ${(i % 2 ? alice : bob).token}`)
          .send({ legs: [{ tripId: flight.id, cls: 'ECO', seats: [seat] }], seated: 1, petSize: null }),
      ),
    )
    expect(attempts.filter((r) => r.status === 201)).toHaveLength(1)
    expect(attempts.filter((r) => r.status === 409)).toHaveLength(19)
  })

  it('shows a seat held by someone else as unavailable', async () => {
    const res = await api.get(`/api/trips/${flight.id}/seats`).query({ cls: 'ECO' })
    expect(res.body.held).toContain(freeSeats[0])
  })
})

describe('bookings', () => {
  let pnr: string

  it('books held seats, recomputing the price on the server', async () => {
    const seat = freeSeats[1]
    const hold = await api.post('/api/holds').set('Authorization', `Bearer ${alice.token}`).send({ legs: [{ tripId: flight.id, cls: 'ECO', seats: [seat] }], seated: 1, petSize: null })
    expect(hold.status).toBe(201)

    const key = randomUUID()
    const res = await api.post('/api/bookings').set('Authorization', `Bearer ${alice.token}`).set('Idempotency-Key', key).send(bookingBody(flight, 'ECO', [seat], hold.body.holdId))
    expect(res.status).toBe(201)
    pnr = res.body.booking.pnr
    expect(res.body.booking.legs[0]).toMatchObject({ status: 'CONFIRMED', seats: [seat] })
    const expected = quote({ legs: [{ trip: flight, cls: 'ECO', seatExtras: 0, bin: false }], seated: 1, infants: 0, petSize: null, fareType: 'regular', quota: 'GN', coupon: null })
    expect(res.body.booking.quote.total).toBe(expected.total)

    // A network retry with the same key returns the same booking instead of charging again.
    const retry = await api.post('/api/bookings').set('Authorization', `Bearer ${alice.token}`).set('Idempotency-Key', key).send(bookingBody(flight, 'ECO', [seat], hold.body.holdId))
    expect(retry.status).toBe(200)
    expect(retry.body.booking.pnr).toBe(pnr)
    expect(await prisma.booking.count({ where: { user: { email: 'alice@test.dev' } } })).toBe(1)
  })

  it('refuses to hold or book a seat that is already sold', async () => {
    const hold = await api.post('/api/holds').set('Authorization', `Bearer ${bob.token}`).send({ legs: [{ tripId: flight.id, cls: 'ECO', seats: [freeSeats[1]] }], seated: 1, petSize: null })
    expect(hold.status).toBe(409)
  })

  it('refuses to book without a valid hold', async () => {
    const res = await api.post('/api/bookings').set('Authorization', `Bearer ${bob.token}`).set('Idempotency-Key', randomUUID()).send(bookingBody(flight, 'ECO', [freeSeats[2]], randomUUID()))
    expect(res.status).toBe(409)
  })

  it('rejects travellers that break the rules', async () => {
    const seat = freeSeats[3]
    const hold = await api.post('/api/holds').set('Authorization', `Bearer ${bob.token}`).send({ legs: [{ tripId: flight.id, cls: 'ECO', seats: [seat] }], seated: 1, petSize: null })
    const res = await api
      .post('/api/bookings')
      .set('Authorization', `Bearer ${bob.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ ...bookingBody(flight, 'ECO', [seat], hold.body.holdId), fareType: 'senior' })
    expect(res.status).toBe(422)
    expect(res.body.details['p0.age']).toMatch(/60\+/)
  })

  it("hides other people's bookings", async () => {
    const res = await api.get(`/api/bookings/${pnr}`).set('Authorization', `Bearer ${bob.token}`)
    expect(res.status).toBe(404)
  })
})

describe('waitlist', () => {
  it('confirms the oldest waitlisted booking when a confirmed one is cancelled', async () => {
    // Find a train class that is full, so new bookings go on the waitlist.
    let train: Trip | undefined
    let cls = ''
    for (let d = 10; d < 60 && !train; d++) {
      for (const t of generateTrips('train', 'BLR', 'DEL', addDaysISO(todayIST(), d))) {
        const full = t.classes.find((c) => c.available === 0 && !c.isPet)
        if (full) {
          train = t
          cls = full.code
          break
        }
      }
    }
    expect(train).toBeDefined()

    // Bob joins the waitlist (no seats yet).
    const wl = await api.post('/api/bookings').set('Authorization', `Bearer ${bob.token}`).set('Idempotency-Key', randomUUID()).send(bookingBody(train!, cls, [], null, [adult('Bob Iyer')]))
    expect(wl.status).toBe(201)
    expect(wl.body.booking.legs[0].status).toBe('WAITLIST')

    // Alice holds a confirmed berth from before the class filled up (inserted directly).
    const berth = trainCoaches(train!, cls).flatMap((c) => c.seats).find((s) => s.taken)!.id
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@test.dev' } })
    await prisma.booking.create({
      data: {
        pnr: '1234567890',
        userId: user.id,
        mode: 'train',
        fareType: 'regular',
        quota: 'GN',
        contact,
        quote: { lines: [], taxes: 0, total: 500 },
        totalPaise: 50000,
        passengers: { create: [{ position: 0, type: 'Adult', name: 'Alice Rao', age: 30, gender: 'Female' }] },
        payment: { create: { idempotencyKey: randomUUID(), method: 'card', ref: 'x', amountPaise: 50000 } },
        legs: { create: [{ position: 0, tripId: train!.id, cls, status: 'CONFIRMED', trip: train as object, seats: { create: [{ tripId: train!.id, seatId: berth, position: 0 }] } }] },
      },
    })

    const cancel = await api.post('/api/bookings/1234567890/cancel').set('Authorization', `Bearer ${alice.token}`)
    expect(cancel.status).toBe(200)
    expect(cancel.body.promoted).toEqual([wl.body.booking.pnr])

    const promoted = await api.get(`/api/bookings/${wl.body.booking.pnr}`).set('Authorization', `Bearer ${bob.token}`)
    expect(promoted.body.booking.legs[0]).toMatchObject({ status: 'CONFIRMED', seats: [berth] })
  })
})
