# SkyVoyage — Frontend

Flight and train booking with dedicated pet support: pet rows on flights, a pet coach on trains, and a pet pass with every ticket.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · Framer Motion · React Router · Zustand · qrcode.react · html-to-image

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

Start the backend first (see the root README), then create an account at `/register` (booking requires sign-in). Test card at checkout: `4111 1111 1111 1111`, any future expiry, any 3-digit CVV.

## Features

- **Search:** flights or trains, one way or round trip, adults / children / infants, cabin class, special fares (student, senior citizen, armed forces) and train quotas (General, Tatkal, Ladies, Senior citizen). International flights to Dubai, Singapore, the Maldives, Bali, Zurich and Santorini.
- **Seats:** aircraft cabin and train coach maps, overhead bin reservation, a 5-minute seat hold, and pet rules (pet rows on flights; best-fit pet cabin on trains).
- **Waitlist:** full train classes book on the waitlist, and cancelling a confirmed booking promotes the next waitlisted one.
- **Offers:** coupon codes (`FLYHIGH`, `PAWSOME`, `RAILJOY`, `ROUNDTRIP`, `GOINTL`) applied at payment.
- **Tickets:** boarding passes with QR codes, lap-infant details, a pet pass, download as PNG or print to PDF.
- **Account:** login / register, My trips, PNR status, About and Offers pages.

## Where things live

| Path | What it does |
|---|---|
| `src/lib/data.ts` | Cities, seeded trip generator (same search ⇒ same results), fare types, quotas, pet sizes |
| `src/lib/search.ts` | Search values ⇄ URL query string |
| `src/lib/seats.ts` | Aircraft rows and train coach layouts, **best-fit pet cabin allocation** |
| `src/lib/pricing.ts` | Fare breakdown per leg: base, Tatkal, upgrades, bin, infants, pet fare, special-fare and coupon discounts, 5% tax |
| `src/lib/offers.ts` | Offer list and coupon rules |
| `src/store/booking.ts` | Booking draft (legs), seat hold, confirm, **cancel → waitlist promotion** |
| `src/store/auth.ts` | Session state; access token in memory, refresh token in an httpOnly cookie |
| `src/lib/api.ts` | Fetch wrapper with automatic session refresh |
| `src/components/Brand.tsx` | SkyVoyage logo and airline / train logos |
| `src/pages/*` | One file per page |

## Backend

The app talks to the REST API in `../backend` through Vite's `/api` proxy (start it first, see the root README). Pricing, seat layouts and booking rules live in `../shared` and are used by both apps; `src/lib/{data,seats,pricing,offers}.ts` re-export them.
