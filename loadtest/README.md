# Load testing (k6)

`booking.js` runs three scenarios at the same time against the API:

| Scenario | Load | What it does |
|---|---|---|
| `browse` | ramps to 100 virtual users | search trips, open seat maps |
| `book` | ramps to 30 virtual users | search → seat map → 5-minute hold → pay |
| `race` | 50 virtual users at once | everyone tries to book the **same seat**; exactly one may win |

Virtual users don't pause between requests, so this is a worst-case burst, not normal traffic.

## Run it

Use a separate database so development data stays clean:

```bash
# once: create the load-test database
cd backend
DATABASE_URL="postgresql://skyvoyage:skyvoyage@127.0.0.1:5432/skyvoyage_load?schema=public" npx prisma migrate deploy

# production build of the API on port 4100
npm run build
DATABASE_URL="postgresql://skyvoyage:skyvoyage@127.0.0.1:5432/skyvoyage_load?schema=public&connection_limit=20" \
REDIS_URL="redis://127.0.0.1:6379/2" PORT=4100 NODE_ENV=production node dist/index.js

# in another terminal, from the repo root (k6 runs in Docker, nothing to install)
docker run --rm -i -e BASE_URL=http://host.docker.internal:4100 grafana/k6:0.57.0 run - < loadtest/booking.js
```

## Results (29 Oct 2026, one Windows laptop running k6, Docker PostgreSQL/Redis and the API together)

The first run exposed the bottleneck: booking transactions waited for pooled database connections and hit Prisma's 5-second transaction limit (error P2028). Fixes:

1. Booking, legs, passengers, seats and payment written in **one nested insert** instead of many round trips.
2. **Redis cache for search results**, invalidated whenever a booking or cancellation touches that trip.
3. Database **connection pool raised to 20** and explicit transaction wait limits.

| Metric | Before | After | Change |
|---|---|---|---|
| Failed requests | 39 of 5,118 | 0 of 12,161 | errors eliminated |
| Bookings completed | 118 | 342 | 2.9× |
| Throughput | 55.6 req/s | 144.2 req/s | 2.6× |
| Search p95 | 5.33 s | 1.09 s | −80% |
| Seat map p95 | 4.77 s | 1.02 s | −79% |
| Seat hold p95 | 7.15 s | 1.57 s | −78% |
| Booking p95 | 18.59 s | 4.24 s | −77% |
| Same-seat race (50 users) | 1 winner | 1 winner | no double booking |

The script's latency thresholds (p95 under 0.5–1.5 s) are still crossed under this zero-pause burst on shared laptop hardware; they are kept as the target for the next round of tuning.
