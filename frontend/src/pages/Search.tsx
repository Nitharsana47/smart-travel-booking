import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ArrowRightLeft, Check, Moon, PawPrint, Pencil, Plane, SearchX, SlidersHorizontal, Sun, Sunrise, Sunset, TrainFront, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { OperatorLogo } from '../components/Brand'
import { SearchWidget } from '../components/SearchWidget'
import { EASE } from '../components/ui'
import { cityByCode, FARE_TYPES, generateTrips, PET_SIZES, QUOTAS, type FareClass, type Mode, type Trip } from '../lib/data'
import { api } from '../lib/api'
import { addDays, cn, fmtDate, fmtDuration, fmtTime, inr, todayISO } from '../lib/format'
import { TATKAL_RATE } from '../lib/pricing'
import { parseSearch, travellerSummary, type SearchValues } from '../lib/search'
import { useBooking } from '../store/booking'

const SLOTS = [
  { id: 'early', label: 'Before 6 AM', icon: Moon, from: 0, to: 360 },
  { id: 'morning', label: '6 AM – 12 PM', icon: Sunrise, from: 360, to: 720 },
  { id: 'afternoon', label: '12 PM – 6 PM', icon: Sun, from: 720, to: 1080 },
  { id: 'night', label: 'After 6 PM', icon: Sunset, from: 1080, to: 1440 },
]
const SORTS = { cheapest: 'Cheapest', fastest: 'Fastest', earliest: 'Earliest' } as const
type Sort = keyof typeof SORTS
type Pick = { trip: Trip; cls: FareClass }

const minPrice = (t: Trip) => Math.min(...t.classes.map((c) => c.price))

/** The fare shown on a class chip: Tatkal adds 30%, flight special fares take their discount off. */
const displayPrice = (v: SearchValues, c: FareClass) => {
  if (v.mode === 'train') return v.quota === 'TQ' ? Math.round(c.price * (1 + TATKAL_RATE)) : c.price
  return Math.round(c.price * (1 - FARE_TYPES[v.fare].discount))
}

/**
 * Live search results from the API (availability includes real bookings and waitlists).
 * If the API can't be reached, fall back to the published timetable so results never disappear;
 * the server still re-checks every seat when you book.
 */
function useTrips(mode: Mode, from: string, to: string, date: string) {
  const [state, setState] = useState<{ key: string; trips: Trip[]; offline: boolean }>({ key: '', trips: [], offline: false })
  const key = [mode, from, to, date].join('|')
  useEffect(() => {
    let live = true
    api<{ trips: Trip[] }>(`/trips/search?${new URLSearchParams({ mode, from, to, date })}`)
      .then((r) => live && setState({ key, trips: r.trips, offline: false }))
      .catch(() => live && setState({ key, trips: generateTrips(mode, from, to, date), offline: true }))
    return () => {
      live = false
    }
  }, [key, mode, from, to, date])
  const ready = state.key === key
  return { trips: ready ? state.trips : [], loading: !ready, offline: ready && state.offline }
}

export default function Search() {
  const [params] = useSearchParams()
  // Remount on every new search so selections and filters reset cleanly.
  return <Results key={params.toString()} />
}

function Results() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const start = useBooking((s) => s.start)
  const v = parseSearch(params)
  const round = v.trip === 'round'
  const seated = v.adults + v.children

  const [editing, setEditing] = useState(false)
  const [stage, setStage] = useState<0 | 1>(0)
  const [picks, setPicks] = useState<(Pick | null)[]>([null, null])
  const [slots, setSlots] = useState<string[]>([])
  const [sort, setSort] = useState<Sort>('cheapest')
  const [petOnly, setPetOnly] = useState(true)
  const [nonstop, setNonstop] = useState(false)

  const leg = stage === 0 ? { from: v.from, to: v.to, date: v.date } : { from: v.to, to: v.from, date: v.ret }
  const { trips, loading, offline } = useTrips(v.mode, leg.from, leg.to, leg.date)
  const visible = useMemo(() => {
    const list = trips.filter(
      (t) =>
        (!v.pet || !petOnly || t.petFriendly) &&
        (!nonstop || t.stops === 0) &&
        (slots.length === 0 || SLOTS.some((s) => slots.includes(s.id) && t.depMin >= s.from && t.depMin < s.to)),
    )
    const by: Record<Sort, (a: Trip, b: Trip) => number> = {
      cheapest: (a, b) => minPrice(a) - minPrice(b),
      fastest: (a, b) => a.durMin - b.durMin,
      earliest: (a, b) => a.depMin - b.depMin,
    }
    return [...list].sort(by[sort])
  }, [trips, v.pet, petOnly, nonstop, slots, sort])

  const days = useMemo(() => {
    const floor = stage === 0 ? todayISO() : v.date
    const first = [addDays(leg.date, -3), floor].sort()[1]
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(first, i)
      const list = generateTrips(v.mode, leg.from, leg.to, d)
      const open = list.filter((t) => t.classes.some((c) => c.available > 0)).length
      return { date: d, label: v.mode === 'flight' ? (list.length ? inr(Math.min(...list.map(minPrice))) : '—') : `${open} trains` }
    })
  }, [v.mode, v.date, leg.from, leg.to, leg.date, stage])

  const book = (legs: Pick[]) => {
    start({ legs: legs.map((p) => ({ tripId: p.trip.id, cls: p.cls.code })), adults: v.adults, children: v.children, infants: v.infants, petSize: v.pet, fareType: v.fare, quota: v.quota })
    navigate('/book/seats')
  }

  const onPick = (trip: Trip, cls: FareClass) => {
    if (!round) return book([{ trip, cls }])
    const next = [...picks]
    next[stage] = { trip, cls }
    setPicks(next)
    if (stage === 0) {
      setStage(1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const setDate = (d: string) => {
    const next = new URLSearchParams(params)
    if (stage === 0) {
      next.set('date', d)
      if (round && v.ret < d) next.set('ret', d)
    } else next.set('ret', d)
    setParams(next)
  }

  const fromCity = cityByCode(v.from)!
  const toCity = cityByCode(v.to)!
  const ModeIcon = v.mode === 'flight' ? Plane : TrainFront

  return (
    <main className={cn('min-h-screen bg-sky-50/60 pb-24', round && 'pb-48')}>
      <section className="relative overflow-hidden bg-gradient-to-br from-[#06213d] via-[#0a3463] to-[#0c4a86] pb-28 pt-28">
        {/* Soft glows and a faint route line keep the navy from feeling flat */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20" viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden>
          <path d="M-20 330 C 300 260 520 120 820 140 S 1250 60 1460 30" fill="none" stroke="#7dd3fc" strokeWidth="2" strokeDasharray="6 10" />
        </svg>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE, duration: 0.6 }} className="flex flex-wrap items-end justify-between gap-4 text-white">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-sky-200">
                <ModeIcon size={16} /> {v.mode === 'flight' ? 'Flights' : 'Trains'} · {round ? 'Round trip' : 'One way'} · {fmtDate(v.date, { day: 'numeric', month: 'short' })}
                {round && ` – ${fmtDate(v.ret, { day: 'numeric', month: 'short' })}`}
              </p>
              <h1 className="mt-2 flex flex-wrap items-center gap-3 font-display text-3xl font-bold sm:text-5xl">
                {fromCity.name}
                {round ? <ArrowRightLeft className="text-sky-300" /> : <ArrowRight className="text-sky-300" />}
                {toCity.name}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sky-100">
                {travellerSummary(v)}
                {v.mode === 'flight' && v.fare !== 'regular' && <Badge>{FARE_TYPES[v.fare].label} fare</Badge>}
                {v.mode === 'train' && v.quota !== 'GN' && <Badge>{QUOTAS[v.quota].label} quota</Badge>}
                {v.pet && (
                  <Badge>
                    <PawPrint size={14} /> {PET_SIZES[v.pet].label} pet
                  </Badge>
                )}
              </p>
            </div>
            <button onClick={() => setEditing((e) => !e)} className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20">
              <Pencil size={15} /> {editing ? 'Close' : 'Modify search'}
            </button>
          </motion.div>
          <AnimatePresence initial={false}>
            {editing && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ease: EASE, duration: 0.4 }}>
                <div className="pt-6">
                  <SearchWidget initial={v} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <div className="relative mx-auto -mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        {round && (
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-3xl bg-white/90 p-2 shadow-soft ring-1 ring-sky-100 backdrop-blur">
            {[0, 1].map((i) => {
              const p = picks[i]
              const [a, b, d] = i === 0 ? [v.from, v.to, v.date] : [v.to, v.from, v.ret]
              return (
                <button key={i} onClick={() => setStage(i as 0 | 1)} disabled={i === 1 && !picks[0]} className={cn('relative rounded-2xl px-4 py-3 text-left transition disabled:opacity-50', stage === i ? 'text-white' : 'hover:bg-sky-50')}>
                  {stage === i && <motion.span layoutId="leg-tab" className="absolute inset-0 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600" />}
                  <span className="relative flex items-center justify-between gap-2">
                    <span>
                      <span className="block text-xs font-bold uppercase tracking-widest opacity-80">
                        {i + 1}. {i === 0 ? 'Departure' : 'Return'} · {fmtDate(d)}
                      </span>
                      <span className="block font-display font-bold">
                        {a} → {b}
                      </span>
                    </span>
                    {p && (
                      <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', stage === i ? 'bg-white/25' : 'bg-emerald-50 text-emerald-700')}>
                        <Check size={12} /> {fmtTime(p.trip.depMin)}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-3xl bg-white p-2 shadow-float ring-1 ring-sky-100">
          {days.map((d) => (
            <button key={d.date} onClick={() => setDate(d.date)} className={cn('relative min-w-[7.5rem] flex-1 rounded-2xl px-3 py-3 text-center transition', d.date === leg.date ? 'text-white' : 'hover:bg-sky-50')}>
              {d.date === leg.date && <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-gradient-to-b from-sky-500 to-sky-600" />}
              <span className="relative block text-xs font-semibold opacity-80">{fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className="relative block font-display font-bold">{d.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[17rem_1fr]">
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-sky-100">
              <h2 className="flex items-center gap-2 font-display font-bold">
                <SlidersHorizontal size={17} className="text-sky-500" /> Filters
              </h2>
              <p className="mt-5 text-xs font-bold uppercase tracking-widest text-ink-soft">Departure time</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SLOTS.map((s) => {
                  const on = slots.includes(s.id)
                  return (
                    <button key={s.id} onClick={() => setSlots(on ? slots.filter((x) => x !== s.id) : [...slots, s.id])} className={cn('flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-semibold ring-1 transition', on ? 'bg-sky-500 text-white ring-sky-500' : 'text-ink-soft ring-sky-100 hover:bg-sky-50')}>
                      <s.icon size={17} /> {s.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-5 space-y-3">
                {v.pet && <Toggle label="Pet-friendly only" icon={<PawPrint size={15} className="text-paw" />} on={petOnly} set={setPetOnly} />}
                {v.mode === 'flight' && <Toggle label="Non-stop only" on={nonstop} set={setNonstop} />}
              </div>
              {v.mode === 'train' && v.quota === 'TQ' && (
                <p className="mt-5 flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs font-medium text-amber-800">
                  <Zap size={14} className="mt-0.5 shrink-0" /> Tatkal fares are 30% higher; when the Tatkal quota runs out you'll be on the Tatkal waitlist (TQWL).
                </p>
              )}
            </div>
          </aside>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                {round && <b className="text-sky-700">{stage === 0 ? 'Choose your departure · ' : 'Choose your return · '}</b>}
                <b className="text-ink">{visible.length}</b> {v.mode === 'flight' ? 'flights' : 'trains'} found
              </p>
              <div className="flex rounded-2xl bg-white p-1 shadow-soft ring-1 ring-sky-100">
                {(Object.keys(SORTS) as Sort[]).map((s) => (
                  <button key={s} onClick={() => setSort(s)} className={cn('relative rounded-xl px-4 py-2 text-sm font-semibold transition', sort === s ? 'text-sky-700' : 'text-ink-soft')}>
                    {sort === s && <motion.span layoutId="sort-pill" className="absolute inset-0 rounded-xl bg-sky-100" />}
                    <span className="relative">{SORTS[s]}</span>
                  </button>
                ))}
              </div>
            </div>

            <motion.ul layout className="space-y-4">
              <AnimatePresence mode="popLayout">
                {visible.map((t, i) => (
                  <motion.li key={t.id} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.45, ease: EASE, delay: i * 0.05 }}>
                    <TripCard trip={t} v={v} picked={picks[stage]} onPick={onPick} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
            {loading && (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-48 animate-pulse rounded-3xl bg-white/80 ring-1 ring-sky-100" />
                ))}
              </div>
            )}
            {offline && (
              <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
                Showing the scheduled timetable: live seat counts couldn't be loaded right now. Seats are re-checked when you book.
              </p>
            )}
            {!loading && visible.length === 0 && (
              <div className="rounded-3xl bg-white p-12 text-center shadow-soft ring-1 ring-sky-100">
                <SearchX className="mx-auto text-sky-300" size={44} />
                <h3 className="mt-4 font-display text-xl font-bold">No matches</h3>
                <p className="mt-1 text-ink-soft">{v.from === v.to ? 'Origin and destination are the same.' : 'Try clearing a filter or picking another date.'}</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <AnimatePresence>
        {round && picks[0] && (
          <motion.div initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-100 bg-white/95 shadow-[0_-20px_50px_-20px_rgb(3_105_161/0.3)] backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
              {picks.map((p, i) =>
                p ? (
                  <div key={i} className="flex min-w-0 items-center gap-3">
                    <OperatorLogo trip={p.trip} className="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">{i === 0 ? 'Departure' : 'Return'}</p>
                      <p className="truncate text-sm font-bold">
                        {fmtTime(p.trip.depMin)} · {p.trip.number} · {p.cls.name} · {inr(displayPrice(v, p.cls))}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p key={i} className="text-sm font-semibold text-ink-soft">Now choose your return {v.mode === 'flight' ? 'flight' : 'train'} ↑</p>
                ),
              )}
              <div className="ml-auto flex items-center gap-4">
                {picks[0] && picks[1] && (
                  <p className="text-right">
                    <span className="block text-xs text-ink-soft">Fare for {seated} · before extras</span>
                    <span className="font-display text-2xl font-bold">{inr((displayPrice(v, picks[0].cls) + displayPrice(v, picks[1].cls)) * seated)}</span>
                  </p>
                )}
                <button disabled={!picks[0] || !picks[1]} onClick={() => book([picks[0]!, picks[1]!])} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 px-6 py-3.5 font-bold text-white shadow-soft transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0">
                  Continue <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-sm font-semibold ring-1 ring-white/20 backdrop-blur">{children}</span>
}

function Toggle({ label, on, set, icon }: { label: string; on: boolean; set: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => set(!on)} className="flex w-full items-center justify-between gap-3 text-sm font-semibold text-ink">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition', on ? 'bg-sky-500' : 'bg-slate-200')}>
        <motion.span layout className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow', on ? 'right-1' : 'left-1')} />
      </span>
    </button>
  )
}

function TripCard({ trip, v, picked, onPick }: { trip: Trip; v: SearchValues; picked: Pick | null; onPick: (t: Trip, c: FareClass) => void }) {
  const Icon = trip.mode === 'flight' ? Plane : TrainFront
  const arr = trip.depMin + trip.durMin
  const nextDay = Math.floor(arr / 1440)
  const blockedForPet = !!v.pet && !trip.petFriendly
  const code = (c: { code: string; station: string }) => (trip.mode === 'flight' ? c.code : c.station)
  const isPicked = picked?.trip.id === trip.id

  return (
    <article className={cn('group overflow-hidden rounded-3xl bg-white shadow-soft ring-1 transition hover:shadow-float', isPicked ? 'ring-2 ring-sky-400' : 'ring-sky-100', blockedForPet && 'opacity-60')}>
      {/* Top half: navy band with the journey */}
      <div className="relative grid items-center gap-5 overflow-hidden bg-gradient-to-br from-[#06213d] via-[#0a3463] to-[#0c4a86] p-5 text-white sm:p-6 md:grid-cols-[13rem_1fr]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-sky-400/15 blur-2xl" />
        <div className="flex items-center gap-3">
          <OperatorLogo trip={trip} />
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{trip.operator}</p>
            <p className="text-sm text-sky-200">{trip.number}</p>
          </div>
        </div>

        <div className="relative flex items-center gap-4">
          <div>
            <p className="font-display text-2xl font-bold tabular-nums">{fmtTime(trip.depMin)}</p>
            <p className="text-sm font-semibold text-sky-200">{code(trip.from)}</p>
          </div>
          <div className="flex flex-1 flex-col items-center px-2">
            <span className="text-xs font-semibold text-sky-200">{fmtDuration(trip.durMin)}</span>
            <div className="relative my-1.5 h-px w-full bg-gradient-to-r from-sky-400/40 via-sky-300 to-sky-400/40">
              <span className="absolute -top-[3px] left-0 h-[7px] w-[7px] rounded-full bg-sky-300" />
              <span className="absolute -top-[3px] right-0 h-[7px] w-[7px] rounded-full bg-sky-300" />
              <Icon size={16} className="absolute -top-2 left-1/2 -translate-x-1/2 text-sky-300 transition-all duration-700 group-hover:left-[80%]" />
            </div>
            <span className="text-xs text-sky-200/80">{trip.mode === 'flight' ? (trip.stops ? '1 stop' : 'Non-stop') : `${trip.stops} halts · ${trip.km} km`}</span>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold tabular-nums">
              {fmtTime(arr)}
              {nextDay > 0 && <sup className="ml-0.5 text-xs font-bold text-amber-300">+{nextDay}</sup>}
            </p>
            <p className="text-sm font-semibold text-sky-200">{code(trip.to)}</p>
          </div>
        </div>
      </div>

      {/* Bottom half: tags and fares on white */}
      <div className="p-5 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {trip.petFriendly ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-paw-soft px-3 py-1 text-xs font-bold text-amber-800">
              <PawPrint size={13} /> Pet friendly
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">No pets</span>
          )}
          {trip.amenities.map((a) => (
            <span key={a} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{a}</span>
          ))}
          {trip.mode === 'train' && v.quota === 'TQ' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
              <Zap size={12} /> Tatkal: {trip.tatkalLeft ? `${trip.tatkalLeft} left` : 'TQWL'}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {trip.classes.map((c) => {
            const petNeedsCoach = trip.mode === 'train' && !!v.pet && !c.isPet
            const soldOut = trip.mode === 'flight' && c.available < v.adults + v.children
            const disabled = blockedForPet || petNeedsCoach || soldOut
            const preferred = v.cls === c.code
            const chosen = isPicked && picked?.cls.code === c.code
            return (
              <button
                key={c.code}
                disabled={disabled}
                onClick={() => onPick(trip, c)}
                title={petNeedsCoach ? 'Pets travel in the Pet Coach' : undefined}
                className={cn(
                  'group/cls relative rounded-2xl p-3 text-left ring-1 transition',
                  chosen ? 'bg-sky-500 text-white ring-sky-500' : c.isPet ? 'bg-paw-soft/50 ring-amber-200 hover:ring-amber-400' : preferred ? 'bg-sky-50 ring-2 ring-sky-300' : 'ring-sky-100 hover:bg-sky-50 hover:ring-sky-300',
                  disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:ring-sky-100',
                )}
              >
                <span className={cn('flex items-center gap-1 text-xs font-bold', chosen ? 'text-sky-50' : 'text-ink-soft')}>
                  {c.isPet && <PawPrint size={12} className="text-paw" />}
                  {trip.mode === 'train' ? `${c.code} · ${c.name}` : c.name}
                </span>
                <span className="mt-0.5 block font-display text-lg font-bold">{inr(displayPrice(v, c))}</span>
                {chosen ? <span className="text-xs font-bold">Selected</span> : <Availability c={c} mode={trip.mode} />}
                {!disabled && !chosen && <ArrowRight size={15} className="absolute right-3 top-3 text-sky-500 opacity-0 transition group-hover/cls:translate-x-0.5 group-hover/cls:opacity-100" />}
              </button>
            )
          })}
        </div>
      </div>
    </article>
  )
}

function Availability({ c, mode }: { c: FareClass; mode: Mode }) {
  if (mode === 'flight') {
    if (c.available === 0) return <span className="text-xs font-bold text-rose-500">Sold out</span>
    return <span className={cn('text-xs font-bold', c.available < 10 ? 'text-amber-600' : 'text-emerald-600')}>{c.available < 10 ? `Only ${c.available} left` : 'Available'}</span>
  }
  if (c.isPet) return <span className="text-xs font-bold text-amber-700">{Math.ceil(c.available / 4)} cabins open</span>
  if (c.available === 0) return <span className="text-xs font-bold text-amber-600">WL {c.waitlist}</span>
  return <span className="text-xs font-bold text-emerald-600">AVL {c.available}</span>
}

