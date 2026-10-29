import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Briefcase, Check, DoorOpen, ListOrdered, Loader2, PawPrint, Sparkles, Wand2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FareSummary, Stepper, TripHeader } from '../components/BookingParts'
import { Button, Card, PageShell } from '../components/ui'
import type { Trip } from '../lib/data'
import { cn, fmtDate, inr } from '../lib/format'
import { BIN_FEE } from '../lib/pricing'
import { bestFitCabin, berthShort, binFor, FLIGHT_LETTERS, flightRows, trainCoaches, type Coach, type FlightRow, type Seat } from '../lib/seats'
import { api } from '../lib/api'
import { useDraft } from '../lib/useDraft'
import { useBooking } from '../store/booking'
import { useToast } from '../store/toast'

const seatsFor = (trip: Trip, cls: string, taken: string[] = []) =>
  trip.mode === 'flight' ? flightRows(trip, cls, taken).flatMap((r) => r.seats) : trainCoaches(trip, cls, taken).flatMap((c) => c.seats)

/** Seats sold in the database or held by other travellers right now, refreshed every 15 s. */
function useTakenSeats(tripId: string | undefined, cls: string | undefined, holdId: string | null | undefined) {
  const [taken, setTaken] = useState<string[]>([])
  const reload = useCallback(async () => {
    if (!tripId || !cls) return
    const q = new URLSearchParams({ cls, ...(holdId ? { holdId } : {}) })
    const res = await api<{ sold: string[]; held: string[] }>(`/trips/${encodeURIComponent(tripId)}/seats?${q}`).catch(() => null)
    if (res) setTaken([...res.sold, ...res.held])
  }, [tripId, cls, holdId])
  useEffect(() => {
    void reload()
    const id = setInterval(reload, 15_000)
    return () => clearInterval(id)
  }, [reload])
  return { taken, reload }
}

export default function Seats() {
  const ctx = useDraft()
  const updateLeg = useBooking((s) => s.updateLeg)
  const hold = useBooking((s) => s.hold)
  const toast = useToast((s) => s.push)
  const navigate = useNavigate()
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState<Seat | null>(null)
  const [busy, setBusy] = useState(false)
  const draftLegs = useBooking((s) => s.draft?.legs)
  const holdId = useBooking((s) => s.draft?.holdId)
  const current = draftLegs?.[Math.min(active, (draftLegs?.length ?? 1) - 1)]
  const { taken, reload } = useTakenSeats(current?.tripId, current?.cls, holdId)

  if (!ctx) return <Navigate to="/" replace />
  const { draft, legs, seated, quote, mode } = ctx
  type Leg = (typeof legs)[number]
  const legIdx = Math.min(active, legs.length - 1)
  const leg = legs[legIdx]
  const trip = leg.trip
  const fareClass = trip.classes.find((c) => c.code === leg.cls)!
  const petInCabin = mode === 'flight' && draft.petSize === 'small'
  const round = legs.length > 1

  const allSeats = seatsFor(trip, leg.cls, taken)
  const chosen = leg.seats.map((id) => allSeats.find((s) => s.id === id)!).filter(Boolean)
  const hasPetSeat = (l: Leg) => seatsFor(l.trip, l.cls).some((s) => l.seats.includes(s.id) && s.tags.includes('pet'))
  const legReady = (l: Leg) => l.waitlist || (l.seats.length === seated && (!petInCabin || hasPetSeat(l)))
  const pending = legs.findIndex((l, i) => i !== legIdx && !legReady(l))
  const needsPetSeat = petInCabin && !leg.waitlist && leg.seats.length === seated && !hasPetSeat(leg)

  const toggle = (seat: Seat) => {
    if (seat.taken) return
    // Read the latest selection from the store, not this render, so rapid clicks don't overwrite each other.
    const current = useBooking.getState().draft?.legs[legIdx].seats ?? []
    let next = current.includes(seat.id) ? current.filter((s) => s !== seat.id) : [...current, seat.id]
    // Pet coach: the whole party shares one cabin with the pet.
    if (fareClass.isPet && seat.cabin !== undefined) {
      const others = allSeats.filter((s) => current.includes(s.id) && s.cabin !== seat.cabin)
      if (others.length && !current.includes(seat.id)) {
        next = [seat.id]
        toast(`Moved your party to cabin ${seat.cabin} so you stay together with your pet`, 'info')
      }
    }
    if (next.length > seated) next = next.slice(next.length - seated)
    updateLeg(legIdx, { seats: next })
  }

  const proceed = async () => {
    if (pending >= 0) {
      setActive(pending)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setBusy(true)
    const failed = await hold()
    setBusy(false)
    if (failed) {
      // Someone else got there first: drop those seats and refresh the map.
      if (failed.seats.length) legs.forEach((l, i) => updateLeg(i, { seats: l.seats.filter((s) => !failed.seats.includes(s)) }))
      toast(failed.error.includes('sign in') ? 'Please log in to hold your seats' : failed.error, 'warn')
      if (failed.error.includes('sign in')) navigate('/login?next=/book/seats')
      void reload()
      return
    }
    navigate('/book/details')
  }

  const label = !legReady(leg)
    ? needsPetSeat
      ? 'Choose a pet-row seat'
      : `Select ${seated - leg.seats.length} more`
    : pending >= 0
      ? `Next: ${pending === 0 ? 'outbound' : 'return'} seats`
      : leg.waitlist && !round
        ? 'Continue on waitlist'
        : 'Continue'

  return (
    <PageShell>
      <Stepper current={0} />
      <div className="mx-auto mt-10 grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
        <div className="min-w-0 space-y-6">
          {round && (
            <div className="grid grid-cols-2 gap-2 rounded-3xl bg-white p-2 shadow-soft ring-1 ring-sky-100">
              {legs.map((l, i) => (
                <button key={i} onClick={() => setActive(i)} className={cn('relative rounded-2xl px-4 py-3 text-left transition', i === legIdx ? 'text-white' : 'hover:bg-sky-50')}>
                  {i === legIdx && <motion.span layoutId="seat-leg" className="absolute inset-0 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600" />}
                  <span className="relative flex items-center justify-between gap-2">
                    <span>
                      <span className="block text-xs font-bold uppercase tracking-widest opacity-80">
                        {i === 0 ? 'Outbound' : 'Return'} · {fmtDate(l.trip.date)}
                      </span>
                      <span className="block font-display font-bold">
                        {mode === 'flight' ? l.trip.from.code : l.trip.from.station} → {mode === 'flight' ? l.trip.to.code : l.trip.to.station}
                      </span>
                    </span>
                    {legReady(l) && (
                      <span className={cn('grid h-6 w-6 place-items-center rounded-full', i === legIdx ? 'bg-white/25' : 'bg-emerald-100 text-emerald-600')}>
                        <Check size={14} />
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          <Card>
            <TripHeader trip={trip} cls={leg.cls} label={round ? (legIdx === 0 ? 'Outbound' : 'Return') : undefined} />
          </Card>

          {leg.waitlist ? (
            <WaitlistCard trip={trip} wl={fareClass.waitlist + 1} tatkal={draft.quota === 'TQ'} />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-50 px-6 py-5">
                <div>
                  <h2 className="font-display text-xl font-bold">Choose {seated === 1 ? 'your seat' : `${seated} seats`}</h2>
                  <p className="text-sm text-ink-soft">
                    {leg.seats.length} of {seated} selected
                    {draft.infants > 0 && ` · ${draft.infants} infant${draft.infants > 1 ? 's' : ''} on lap`}
                    {petInCabin && ' · one traveller must sit in a pet row (window, rows 27–30)'}
                    {fareClass.isPet && ' · your party and pet share one cabin'}
                  </p>
                </div>
                <SeatInspector seat={hovered} trip={trip} />
              </div>
              <Legend trip={trip} petRows={petInCabin || !!fareClass.isPet} />
              <div className="bg-gradient-to-b from-sky-50/50 to-white px-2 py-8 sm:px-6">
                {trip.mode === 'flight' ? (
                  <FlightMap key={trip.id} trip={trip} cls={leg.cls} taken={taken} selected={leg.seats} highlightPet={petInCabin} onToggle={toggle} onHover={setHovered} />
                ) : (
                  <TrainMap
                    key={trip.id}
                    trip={trip}
                    cls={leg.cls}
                    taken={taken}
                    selected={leg.seats}
                    onToggle={toggle}
                    onHover={setHovered}
                    onAutoAssign={(coach) => {
                      const seats = bestFitCabin(coach, seated)
                      if (!seats) return toast(`No cabin in ${coach.id} has ${seated} free berths together`, 'warn')
                      updateLeg(legIdx, { seats: seats.map((s) => s.id) })
                      toast(`Cabin ${seats[0].cabin} picked: the best fit for your party of ${seated}`, 'success')
                    }}
                    isPet={!!fareClass.isPet}
                  />
                )}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {!leg.waitlist && chosen.length > 0 && (
            <Card>
              <h3 className="font-display font-bold">{round ? (legIdx === 0 ? 'Outbound seats' : 'Return seats') : 'Your seats'}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <AnimatePresence>
                  {chosen.map((s) => (
                    <motion.button
                      layout
                      key={s.id}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      onClick={() => toggle(s)}
                      className="group flex items-center gap-1.5 rounded-xl bg-sky-500 px-3 py-1.5 text-sm font-bold text-white"
                    >
                      {trip.mode === 'flight' ? s.id : s.id.replace('-', ' · ')}
                      <X size={14} className="opacity-60 group-hover:opacity-100" />
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
              {trip.mode === 'flight' && (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-100">
                  <input type="checkbox" checked={leg.bin} onChange={(e) => updateLeg(legIdx, { bin: e.target.checked })} className="mt-1 h-4 w-4 accent-sky-500" />
                  <span className="text-sm">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Briefcase size={15} className="text-sky-500" /> Reserve overhead bin
                    </span>
                    <span className="text-ink-soft">
                      Guaranteed space above your seat{chosen.length ? ` (bin ${[...new Set(chosen.map((s) => binFor(s.id)))].join(', ')})` : ''} · {inr(BIN_FEE)} each
                    </span>
                  </span>
                </label>
              )}
            </Card>
          )}
          <FareSummary quote={quote} petSize={draft.petSize} mode={mode}>
            {needsPetSeat && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">Pick at least one seat in a pet row (the window seats marked with a paw).</p>}
            <Button className="w-full" disabled={!legReady(leg) || busy} onClick={proceed}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : null}
              {label} <ArrowRight size={17} />
            </Button>
          </FareSummary>
        </aside>
      </div>
    </PageShell>
  )
}

function SeatInspector({ seat, trip }: { seat: Seat | null; trip: Trip }) {
  return (
    <div className="hidden h-12 min-w-[13rem] text-right sm:block">
      <AnimatePresence mode="wait">
        {seat && (
          <motion.div key={seat.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
            <p className="font-display font-bold">
              {trip.mode === 'flight' ? `Seat ${seat.id}` : `${seat.id.split('-')[0]} · Berth ${seat.label}`} · {seat.kind}
            </p>
            <p className="text-sm text-ink-soft">
              {seat.taken ? 'Already booked' : [seat.tags.includes('exit') && 'Extra legroom', seat.tags.includes('front') && 'Front of cabin', seat.tags.includes('pet') && 'Pet-friendly', seat.cabin && `Cabin ${seat.cabin}`, seat.extra ? `+${inr(seat.extra)}` : 'Included'].filter(Boolean).join(' · ')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface MapProps {
  trip: Trip
  cls: string
  taken: string[]
  selected: string[]
  onToggle: (s: Seat) => void
  onHover: (s: Seat | null) => void
}

function SeatButton({ seat, selected, onToggle, onHover, className, children }: { seat: Seat; selected: boolean } & Pick<MapProps, 'onToggle' | 'onHover'> & { className?: string; children?: React.ReactNode }) {
  const special = seat.tags.includes('exit') || seat.tags.includes('front')
  const pet = seat.tags.includes('pet')
  return (
    <motion.button
      type="button"
      disabled={seat.taken}
      onClick={() => onToggle(seat)}
      onMouseEnter={() => onHover(seat)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(seat)}
      whileHover={seat.taken ? undefined : { y: -2 }}
      whileTap={seat.taken ? undefined : { scale: 0.9 }}
      animate={selected ? { scale: [1, 1.18, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      aria-pressed={selected}
      aria-label={`${seat.id}, ${seat.kind}${pet ? ", pet row" : ""}${seat.taken ? ", booked" : ""}`}
      className={cn(
        'relative grid place-items-center rounded-t-xl rounded-b-md text-[11px] font-bold transition-colors',
        seat.taken && 'cursor-not-allowed bg-slate-200 text-slate-400',
        !seat.taken && selected && 'bg-sky-500 text-white shadow-[0_6px_14px_-4px_rgb(14_165_233/0.8)]',
        !seat.taken && !selected && (special ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-300 hover:bg-violet-100' : 'bg-white text-sky-700 ring-1 ring-sky-300 hover:bg-sky-50'),
        !seat.taken && !selected && pet && 'ring-2 ring-amber-300',
        className,
      )}
    >
      {seat.taken ? <X size={12} /> : selected ? <Check size={14} /> : children}
      {pet && !seat.taken && !selected && <PawPrint size={10} className="absolute -right-1 -top-1 rounded-full bg-white text-paw" />}
    </motion.button>
  )
}

type SeatTone = 'free' | 'extra' | 'pet' | 'selected' | 'taken'

const SEAT_FILL: Record<SeatTone, { cushion: string; back: string; arm: string; hover: string }> = {
  free: { cushion: 'fill-sky-100', back: 'fill-sky-400', arm: 'fill-sky-300', hover: 'group-hover:fill-sky-200' },
  extra: { cushion: 'fill-violet-100', back: 'fill-violet-400', arm: 'fill-violet-300', hover: 'group-hover:fill-violet-200' },
  pet: { cushion: 'fill-amber-100', back: 'fill-amber-400', arm: 'fill-amber-300', hover: 'group-hover:fill-amber-200' },
  selected: { cushion: 'fill-sky-400', back: 'fill-sky-600', arm: 'fill-sky-500', hover: '' },
  taken: { cushion: 'fill-slate-100', back: 'fill-slate-200', arm: 'fill-slate-100', hover: '' },
}

/** Top-down aircraft seat: cushion facing the nose, backrest behind, armrests either side. */
function SeatGlyph({ tone, className }: { tone: SeatTone; className?: string }) {
  const f = SEAT_FILL[tone]
  return (
    <svg viewBox="0 0 40 44" className={className} aria-hidden>
      <rect x="5" y="3" width="30" height="24" rx="7" className={cn(f.cushion, f.hover, 'transition-colors')} />
      <rect x="4" y="25" width="32" height="16" rx="6" className={cn(f.back, 'transition-colors')} />
      <rect x="0.5" y="9" width="5" height="26" rx="2.5" className={f.arm} />
      <rect x="34.5" y="9" width="5" height="26" rx="2.5" className={f.arm} />
    </svg>
  )
}

/** Pet rows are only highlighted when the traveller has an in-cabin pet; otherwise they are ordinary seats. */
const seatTone = (seat: Seat, selected: boolean, showPet: boolean): SeatTone =>
  seat.taken ? 'taken' : selected ? 'selected' : showPet && seat.tags.includes('pet') ? 'pet' : seat.tags.includes('exit') || seat.tags.includes('front') ? 'extra' : 'free'

function FlightSeat({ seat, selected, big, showPet, onToggle, onHover }: { seat: Seat; selected: boolean; big: boolean; showPet: boolean } & Pick<MapProps, 'onToggle' | 'onHover'>) {
  const tone = seatTone(seat, selected, showPet)
  return (
    <motion.button
      type="button"
      disabled={seat.taken}
      onClick={() => onToggle(seat)}
      onMouseEnter={() => onHover(seat)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(seat)}
      whileHover={seat.taken ? undefined : { y: -3 }}
      whileTap={seat.taken ? undefined : { scale: 0.88 }}
      animate={selected ? { scale: [1, 1.2, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      aria-pressed={selected}
      aria-label={`${seat.id}, ${seat.kind}${seat.tags.includes('pet') ? ', pet row' : ''}${seat.taken ? ', booked' : ''}`}
      className={cn('group relative grid shrink-0 place-items-center focus-visible:outline-none', big ? 'h-14 w-12' : 'h-11 w-9 sm:h-12 sm:w-10', seat.taken && 'cursor-not-allowed')}
    >
      <SeatGlyph tone={tone} className={cn('absolute inset-0 h-full w-full', tone === 'taken' && 'opacity-70', selected && 'drop-shadow-[0_6px_10px_rgba(2,132,199,0.45)]', 'group-focus-visible:drop-shadow-[0_0_0_2px_#0ea5e9]')} />
      <span className="relative -mt-2 grid place-items-center">
        {selected ? (
          <Check size={big ? 16 : 14} strokeWidth={3} className="text-white" />
        ) : tone === 'pet' ? (
          <PawPrint size={12} className="text-amber-500" />
        ) : tone === 'extra' ? (
          <span className="text-[10px] font-extrabold text-violet-500">+</span>
        ) : tone === 'free' ? (
          <span className="text-[9px] font-bold text-sky-600 opacity-0 transition group-hover:opacity-100">{seat.id}</span>
        ) : null}
      </span>
    </motion.button>
  )
}

function Legend({ trip, petRows }: { trip: Trip; petRows: boolean }) {
  const items: { label: string; tone: SeatTone }[] = [
    { label: 'Available', tone: 'free' },
    { label: 'Selected', tone: 'selected' },
    { label: 'Booked', tone: 'taken' },
  ]
  if (trip.mode === 'flight') items.push({ label: 'Extra legroom / front', tone: 'extra' })
  if (petRows) items.push({ label: 'Pet friendly', tone: 'pet' })
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-sky-50 px-6 py-3 text-xs font-semibold text-ink-soft">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2">
          {trip.mode === 'flight' ? <SeatGlyph tone={i.tone} className="h-5 w-5" /> : <span className={cn('h-4 w-4 rounded-md', { free: 'bg-white ring-1 ring-sky-300', selected: 'bg-sky-500', taken: 'bg-slate-200', extra: '', pet: 'bg-amber-50 ring-1 ring-amber-300' }[i.tone])} />}
          {i.label}
        </span>
      ))}
    </div>
  )
}

type Tier = 'business' | 'front' | 'standard' | 'exit' | 'pet'

const TIERS: Record<Tier, { label: string; note: (extra: number) => string; tone: string; line: string }> = {
  business: { label: 'Business', note: () => 'Lie-flat · priority boarding', tone: 'bg-sky-50 text-sky-700 ring-sky-100', line: 'from-sky-200' },
  front: { label: 'Front rows', note: (x) => `+${inr(x)} · first off the plane`, tone: 'bg-violet-50 text-violet-700 ring-violet-100', line: 'from-violet-200' },
  standard: { label: 'Standard', note: () => 'Included in your fare', tone: 'bg-sky-50 text-sky-700 ring-sky-100', line: 'from-sky-200' },
  exit: { label: 'Exit rows', note: (x) => `+${inr(x)} · extra legroom`, tone: 'bg-violet-50 text-violet-700 ring-violet-100', line: 'from-violet-200' },
  pet: { label: 'Pet rows', note: () => 'Window seats · pet under the seat in front', tone: 'bg-amber-50 text-amber-700 ring-amber-100', line: 'from-amber-200' },
}

const tierOf = (row: FlightRow, cls: string, highlightPet: boolean): Tier => {
  if (cls === 'BUS') return 'business'
  if (row.exit) return 'exit'
  if (row.row <= 5) return 'front'
  if (highlightPet && row.seats.some((s) => s.tags.includes('pet'))) return 'pet'
  return 'standard'
}

/**
 * Cinema-style seat map: a glowing "front" bar like a screen, row numbers on
 * both sides, and seats grouped into priced sections.
 */
function FlightMap({ trip, cls, taken, selected, highlightPet, onToggle, onHover }: MapProps & { highlightPet: boolean }) {
  const rows = useMemo(() => flightRows(trip, cls, taken), [trip, cls, taken])
  const letters = FLIGHT_LETTERS[cls as 'ECO' | 'BUS']
  const half = letters.length / 2
  const big = cls === 'BUS'
  const colW = big ? 'w-12' : 'w-9 sm:w-10'
  const rowNo = 'w-7 text-center text-[11px] font-bold tabular-nums text-ink-soft/60'

  return (
    <div className="no-scrollbar overflow-x-auto pb-2">
      <div className="mx-auto w-fit min-w-full px-1 sm:min-w-0">
        {/* The "screen": front of the aircraft */}
        <div className="relative mx-auto mb-8 max-w-md px-4 pt-2 text-center">
          <svg viewBox="0 0 400 40" className="h-9 w-full" aria-hidden>
            <defs>
              <linearGradient id="front-bar" x1="0" x2="1">
                <stop offset="0" stopColor="#38bdf8" stopOpacity="0.15" />
                <stop offset="0.5" stopColor="#0ea5e9" />
                <stop offset="1" stopColor="#38bdf8" stopOpacity="0.15" />
              </linearGradient>
              <filter id="front-glow" x="-10%" y="-200%" width="120%" height="500%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            <path d="M10 32 Q200 0 390 32" fill="none" stroke="#7dd3fc" strokeWidth="10" opacity="0.5" filter="url(#front-glow)" />
            <path d="M10 32 Q200 0 390 32" fill="none" stroke="url(#front-bar)" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-600">Front of aircraft</p>
        </div>

        <div className="mb-2 flex items-center justify-center gap-1 sm:gap-1.5">
          <span className={rowNo} />
          {letters.map((l, i) => (
            <div key={l} className="flex items-center">
              {i === half && <span className="w-7 sm:w-9" />}
              <span className={cn(colW, 'text-center text-[11px] font-bold text-ink-soft')}>{l}</span>
            </div>
          ))}
          <span className={rowNo} />
        </div>
        <div className="mb-3 flex justify-between px-1 text-[9px] font-bold uppercase tracking-widest text-ink-soft/50">
          <span>Window</span>
          <span>Aisle</span>
          <span>Window</span>
        </div>

        <div className="space-y-1.5">
          {rows.map((r, idx) => {
            const tier = tierOf(r, cls, highlightPet)
            const startsSection = idx === 0 || tierOf(rows[idx - 1], cls, highlightPet) !== tier
            const extra = Math.max(0, ...r.seats.map((s) => s.extra))
            return (
              <div key={r.row}>
                {startsSection && (
                  <div className={cn('flex items-center gap-3', idx > 0 && 'mt-5', 'mb-2.5')}>
                    <span className={cn('shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ring-1', TIERS[tier].tone)}>{TIERS[tier].label}</span>
                    <span className="truncate text-[11px] font-medium text-ink-soft">{TIERS[tier].note(extra)}</span>
                    <span className={cn('h-px min-w-6 flex-1 bg-gradient-to-r to-transparent', TIERS[tier].line)} />
                  </div>
                )}
                <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <span className={cn(rowNo, r.exit && 'text-emerald-600')}>{r.exit ? <DoorOpen size={13} className="mx-auto" /> : r.row}</span>
                  {r.seats.map((s, i) => (
                    <div key={s.id} className="flex items-center">
                      {i === half && <span className="w-7 sm:w-9" />}
                      <FlightSeat seat={s} selected={selected.includes(s.id)} big={big} showPet={highlightPet} onToggle={onToggle} onHover={onHover} />
                    </div>
                  ))}
                  <span className={cn(rowNo, r.exit && 'text-emerald-600')}>{r.exit ? <DoorOpen size={13} className="mx-auto -scale-x-100" /> : r.row}</span>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-ink-soft/40">Back of aircraft</p>
      </div>
    </div>
  )
}

function TrainMap({ trip, cls, taken, selected, onToggle, onHover, onAutoAssign, isPet }: MapProps & { onAutoAssign: (c: Coach) => void; isPet: boolean }) {
  const coaches = useMemo(() => trainCoaches(trip, cls, taken), [trip, cls, taken])
  const [active, setActive] = useState(() => {
    const withSel = coaches.findIndex((c) => c.seats.some((s) => selected.includes(s.id)))
    return Math.max(0, withSel)
  })
  const coach = coaches[active] ?? coaches[0]

  const groupSize = coach.layout === 'bay8' ? 8 : coach.layout === 'bay6' ? 6 : 4
  const groups = Array.from({ length: coach.seats.length / groupSize }, (_, g) => coach.seats.slice(g * groupSize, g * groupSize + groupSize))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {coaches.map((c, i) => {
            const free = c.seats.filter((s) => !s.taken).length
            return (
              <button key={c.id} onClick={() => setActive(i)} className={cn('rounded-2xl px-4 py-2 text-left ring-1 transition', i === active ? 'bg-sky-500 text-white ring-sky-500' : 'bg-white ring-sky-100 hover:bg-sky-50')}>
                <span className="block font-display font-bold">{c.id}</span>
                <span className={cn('text-xs', i === active ? 'text-sky-50' : 'text-ink-soft')}>{free} free</span>
              </button>
            )
          })}
        </div>
        {isPet && (
          <Button variant="soft" onClick={() => onAutoAssign(coach)} className="py-2.5">
            <Wand2 size={16} /> Best cabin for my party
          </Button>
        )}
      </div>

      <div className="no-scrollbar overflow-x-auto pb-2">
        <div className="flex w-max items-stretch rounded-[28px] border-4 border-sky-100 bg-white p-3">
          <div className="mr-2 grid w-10 place-items-center rounded-2xl bg-sky-50 text-[10px] font-bold uppercase tracking-widest text-ink-soft [writing-mode:vertical-rl]">{coach.id} · Door</div>
          {groups.map((g, gi) => (
            <motion.div key={coach.id + gi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.03 }} className={cn('mx-1 flex flex-col rounded-2xl p-2', isPet ? 'bg-amber-50/60 ring-1 ring-amber-100' : 'bg-sky-50/50')}>
              {coach.layout === 'cabin4' ? (
                <>
                  <span className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-ink-soft">Cabin {gi + 1}</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[g[1], g[3], g[0], g[2]].map((s) => (
                      <Berth key={s.id} seat={s} selected={selected} onToggle={onToggle} onHover={onHover} />
                    ))}
                  </div>
                  {isPet && (
                    <div className="mt-2 flex items-center justify-center gap-1 rounded-xl border-2 border-dashed border-amber-300 py-2 text-[10px] font-bold uppercase text-amber-700">
                      <PawPrint size={12} /> Pet zone
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(coach.layout === 'bay8' ? [g[2], g[5], g[1], g[4], g[0], g[3]] : [g[1], g[3], g[0], g[2]]).map((s) => (
                      <Berth key={s.id} seat={s} selected={selected} onToggle={onToggle} onHover={onHover} />
                    ))}
                  </div>
                  <div className="my-2 h-3 rounded bg-white text-center text-[8px] font-bold uppercase tracking-widest text-ink-soft/50">aisle</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {g.slice(-2).map((s) => (
                      <Berth key={s.id} seat={s} selected={selected} onToggle={onToggle} onHover={onHover} />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          ))}
          <div className="ml-2 grid w-10 place-items-center rounded-2xl bg-sky-50 text-[10px] font-bold uppercase tracking-widest text-ink-soft [writing-mode:vertical-rl]">Door</div>
        </div>
      </div>
    </div>
  )
}

function Berth({ seat, selected, onToggle, onHover }: { seat: Seat; selected: string[] } & Pick<MapProps, 'onToggle' | 'onHover'>) {
  return (
    <SeatButton seat={seat} selected={selected.includes(seat.id)} onToggle={onToggle} onHover={onHover} className="h-11 w-14 flex-col rounded-xl leading-none">
      <span className="text-xs">{seat.label}</span>
      <span className="mt-0.5 text-[9px] font-semibold opacity-70">{berthShort(seat.kind)}</span>
    </SeatButton>
  )
}

function WaitlistCard({ trip, wl, tatkal }: { trip: Trip; wl: number; tatkal: boolean }) {
  return (
    <Card className="relative overflow-hidden">
      <Sparkles className="absolute right-6 top-6 text-amber-300" />
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-600">
        <ListOrdered />
      </span>
      <h2 className="mt-4 font-display text-2xl font-bold">This class is full, but you can still book.</h2>
      <p className="mt-2 max-w-xl leading-relaxed text-ink-soft">
        You'll join the {tatkal ? 'Tatkal waitlist (TQWL)' : 'waitlist'} at position <b className="text-ink">{tatkal ? 'TQWL' : 'WL'} {wl}</b>. When a confirmed passenger on {trip.operator} cancels, the
        earliest waitlisted booking is confirmed automatically and given their berths. Seats are allocated when you're confirmed.
      </p>
    </Card>
  )
}
