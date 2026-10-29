# SkyVoyage — Smart Travel Booking with Pet Support

**Book flights and trains in one place, and bring your pet along.**

SkyVoyage is a full-stack travel booking platform where pets are first-class travellers. Small pets fly in-cabin in dedicated pet rows, trains have a pet coach that keeps each family and its pet in one cabin, every pet's vaccination is checked before confirmation, and each booking comes with a pet pass alongside the boarding pass.

![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express_5-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Playwright](https://img.shields.io/badge/Tested_with-Playwright_·_Vitest_·_k6-2EAD33)

![Home page with destination slideshow and flight search](docs/screenshots/01-home.jpg)

| Search results | Seat selection |
|---|---|
| ![Flight results from Bengaluru to Goa with a small pet](docs/screenshots/02-search.png) | ![Seat map with priced sections and pet rows](docs/screenshots/03-seats.png) |
| **Payment with coupon** | **E-ticket and pet pass** |
| ![Payment page with coupon applied and card preview](docs/screenshots/04-payment.png) | ![Boarding pass with QR code and pet pass](docs/screenshots/05-ticket.png) |

<p align="center"><img src="docs/screenshots/06-mobile.jpg" alt="Home page on a phone" width="260" /></p>

## Features

**Booking**
- Flights and trains, one-way or round trip, across 12 Indian cities and 6 international destinations
- Adults, children and lap infants; cabin classes; student, senior-citizen and armed-forces fares
- Train quotas (General, Tatkal, Ladies, Senior citizen) with an automatic waitlist
- Live seat maps with priced sections (front rows, exit rows, standard) and overhead-bin reservation
- Coupon codes, a full fare breakdown, and QR-code e-tickets you can download or print

**Pet travel**
- In-cabin pets (up to 8 kg) seated in pet rows; larger pets in a climate-controlled hold
- Train pet coach with best-fit cabin allocation, so a party and its pet always share one cabin
- Size, weight and rabies-vaccination checks, and a pet pass issued with every ticket

**Accounts and management**
- Sign up and log in, My Trips, cancellation with refunds, public PNR status
- Admin dashboard with revenue, bookings by status and top routes

## Engineering highlights

**No double booking, enforced in two layers.** When a traveller moves past the seat map, the selected seats are held in Redis for five minutes by a Lua script that reserves every seat atomically or none at all; abandoned checkouts expire on their own. The database then guarantees the same thing independently: `SeatAssignment` has a `UNIQUE(tripId, seatId)` constraint, and the booking transaction locks the trip's inventory row (`SELECT … FOR UPDATE`) so waitlist numbers and Tatkal counts never race. In a load test, 50 users competing for one seat produced exactly one booking.

**The server owns the price.** Pricing, seat layouts and booking rules live in a `shared/` TypeScript module used by both the browser (for instant feedback) and the API (for enforcement). The API recalculates every total and never trusts a price sent by the client.

**Safe payments.** Each checkout carries an `Idempotency-Key`, so a double click or network retry returns the original booking instead of charging twice.

**Waitlist promotion.** Cancelling a confirmed booking frees its seats and, in the same transaction, confirms the oldest waitlisted bookings that fit.

**Secure sessions.** Passwords are hashed with bcrypt. Short-lived JWT access tokens stay in memory; refresh tokens live in httpOnly cookies, are stored only as hashes, and rotate on every use. Reusing an old refresh token is treated as theft and revokes all of the user's sessions, with a short grace window so a quick page reload or a second tab doesn't log anyone out. Logins are rate-limited.

## Performance

Load-tested locally with k6: 100 users browsing, 30 users completing bookings and a 50-user race for one seat, all running at once. The first run exposed booking transactions waiting on database connections; batching the booking into a single insert, caching search results in Redis (invalidated on every booking and cancellation) and sizing the connection pool gave:

| Metric | Before | After |
|---|---|---|
| Failed requests | 39 | **0** |
| Throughput | 55.6 req/s | **144.2 req/s** (2.6×) |
| Search p95 | 5.33 s | **1.09 s** (−80%) |
| Booking p95 | 18.59 s | **4.24 s** (−77%) |
| Same-seat race (50 users) | 1 booking | **1 booking** |

Details and the test script are in [`loadtest/`](loadtest/README.md).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, React Router, Zustand |
| Backend | Node.js, Express 5, TypeScript, Zod |
| Data | PostgreSQL 16 with Prisma ORM, Redis 7 |
| Auth | bcrypt, JWT, rotating httpOnly refresh tokens, role-based access |
| Testing | Vitest + Supertest, Playwright, k6 |
| Tooling | Docker Compose, ESLint |

## Project structure

```
├── frontend/    React single-page app
├── backend/     REST API, Prisma schema and migrations, integration tests
├── shared/      Pricing, seat layouts, coupons and booking rules used by both apps
├── loadtest/    k6 load test and results
├── docs/        Screenshots
├── docker-compose.yml   PostgreSQL and Redis for local development
└── render.yaml          Production deployment configuration
```

The database has nine tables: `User`, `RefreshToken`, `Booking`, `BookingLeg`, `Passenger`, `Pet`, `SeatAssignment`, `Payment` and `TripInventory`.

## Getting started

Requirements: Node.js 20+ and Docker.

```bash
# 1. Start PostgreSQL and Redis
docker compose up -d

# 2. API (http://localhost:4000)
cd backend
cp .env.example .env          # set long random values for the JWT secrets
npm install
npx prisma migrate deploy
npm run dev

# 3. Website (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

Register an account to start booking. The account whose email matches `ADMIN_EMAIL` in `backend/.env` can open the admin dashboard. For checkout, use the test card `4111 1111 1111 1111` with any future expiry date and any CVV; no real payment is made.

## Testing

| Suite | Command | What it covers |
|---|---|---|
| API integration (16 tests) | `cd backend && npm test` | Authentication and token rotation, concurrent seat holds, idempotent payments, traveller rules, waitlist promotion, seat layouts. Uses a separate test database. |
| End-to-end (Playwright) | `cd frontend && npm run test:e2e` | A full booking from search to e-ticket, a held seat blocked for a second user, protected pages. Requires the API to be running. |
| Load (k6) | see [`loadtest/README.md`](loadtest/README.md) | Concurrent browsing, booking and a same-seat race |

## Deployment

In production a single Node service runs the API and serves the built website, so both share one domain. `render.yaml` defines the build, runs database migrations on start and generates the JWT secrets; set `DATABASE_URL` to a managed PostgreSQL connection string and `ADMIN_EMAIL` to the administrator's address. Seat holds use Redis when `REDIS_URL` is set and fall back to in-memory holds on a single instance.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/login`, `/refresh`, `/logout` | Sessions |
| GET | `/api/auth/me` | Current user |
| GET | `/api/trips/search?mode&from&to&date` | Trips with live availability |
| GET | `/api/trips/:id/seats?cls` | Sold, held and free seats |
| POST / DELETE | `/api/holds`, `/api/holds/:id` | Five-minute seat hold |
| POST | `/api/bookings` | Book and pay (requires `Idempotency-Key`) |
| GET | `/api/bookings`, `/api/bookings/:pnr` | My bookings |
| POST | `/api/bookings/:pnr/cancel` | Cancel, refund and promote the waitlist |
| GET | `/api/pnr/:pnr` | Public PNR status |
| GET | `/api/offers` | Coupon codes |
| GET | `/api/admin/stats` | Admin dashboard data |

## Background

SkyVoyage began in 2024 as a PHP and MySQL web-programming project. This version rebuilds it as a typed full-stack application; the original ideas of five-minute seat holds, Tatkal booking, the waitlist and the pet compartment carried over and were extended.

## Author

**Nitharsana C** · [GitHub @Nitharsana47](https://github.com/Nitharsana47)
