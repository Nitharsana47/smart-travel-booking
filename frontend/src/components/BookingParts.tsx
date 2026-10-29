import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock3, PawPrint, TimerOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PET_SIZES, petPlacement, type Mode, type PetSize, type Trip } from '../lib/data'
import { cn, fmtDate, fmtDuration, fmtTime, inr } from '../lib/format'
import type { Quote } from '../lib/pricing'
import { useBooking } from '../store/booking'
import { OperatorLogo } from './Brand'
import { Card } from './ui'

const STEPS = ['Seats', 'Travellers', 'Payment', 'Ticket']

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="no-print mx-auto flex max-w-2xl items-center px-4">
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition',
                  done && 'bg-sky-500 text-white',
                  active && 'bg-white text-sky-600 ring-2 ring-sky-500 shadow-soft',
                  !done && !active && 'bg-white text-ink-soft ring-1 ring-sky-100',
                )}
              >
                {done ? <Check size={16} /> : i + 1}
              </span>
              <span className={cn('text-xs font-semibold', active ? 'text-sky-700' : 'text-ink-soft')}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-2 mb-5 h-0.5 flex-1 overflow-hidden rounded bg-sky-100">
                <motion.div className="h-full bg-sky-500" initial={{ width: 0 }} animate={{ width: done ? '100%' : '0%' }} transition={{ duration: 0.6 }} />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Countdown for the seat hold. When it hits zero the seats are released and the user goes back to the seat map. */
export function HoldTimer() {
  const holdUntil = useBooking((s) => s.draft?.holdUntil ?? null)
  const release = useBooking((s) => s.release)
  const navigate = useNavigate()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!holdUntil) return null
  const left = Math.max(0, holdUntil - now)
  const mm = String(Math.floor(left / 60000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
  const urgent = left < 60_000

  return (
    <>
      <div className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 transition-colors', urgent ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-sky-50 text-sky-700 ring-sky-100')}>
        <Clock3 size={16} className={urgent ? 'animate-pulse' : ''} />
        Seats held for <span className="font-mono tabular-nums">{mm}:{ss}</span>
      </div>
      <AnimatePresence>
        {left === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[70] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-float">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-600">
                <TimerOff />
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold">Your seats were released</h2>
              <p className="mt-2 text-ink-soft">The 5-minute hold ran out, so other travellers can book those seats again. Your details are saved; just pick your seats once more.</p>
              <button
                className="mt-6 w-full rounded-2xl bg-sky-500 py-3.5 font-bold text-white transition hover:bg-sky-600"
                onClick={() => {
                  release()
                  navigate('/book/seats')
                }}
              >
                Choose seats again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function TripHeader({ trip, cls, label }: { trip: Trip; cls: string; label?: string }) {
  const fareClass = trip.classes.find((c) => c.code === cls)
  return (
    <div className="flex min-w-0 items-center gap-4">
      <OperatorLogo trip={trip} />
      <div className="min-w-0">
        {label && <p className="text-[11px] font-bold uppercase tracking-widest text-sky-600">{label}</p>}
        <p className="truncate font-display text-lg font-bold text-ink">
          {trip.from.name} → {trip.to.name}
        </p>
        <p className="truncate text-sm text-ink-soft">
          {trip.operator} {trip.number} · {fmtDate(trip.date)} · {fmtTime(trip.depMin)} · {fmtDuration(trip.durMin)} · {fareClass?.name}
        </p>
      </div>
    </div>
  )
}

export function FareSummary({ quote, petSize, mode, children }: { quote: Quote; petSize: PetSize | null; mode: Mode; children?: React.ReactNode }) {
  return (
    <Card className="p-0">
      <div className="border-b border-sky-50 p-6">
        <h3 className="font-display text-lg font-bold">Fare summary</h3>
        <ul className="mt-4 space-y-2.5 text-sm">
          {quote.lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-4">
              <span className="text-ink-soft">{l.label}</span>
              <span className={cn('shrink-0 font-semibold tabular-nums', l.amount < 0 && 'text-emerald-600')}>{l.amount < 0 ? `−${inr(-l.amount)}` : inr(l.amount)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4">
            <span className="text-ink-soft">Taxes & fees (5%)</span>
            <span className="font-semibold tabular-nums">{inr(quote.taxes)}</span>
          </li>
        </ul>
        {petSize && (
          <div className="mt-4 flex gap-3 rounded-2xl bg-paw-soft/70 p-3 text-sm text-amber-900">
            <PawPrint size={18} className="mt-0.5 shrink-0 text-paw" />
            <span>
              <b>{PET_SIZES[petSize].label} pet</b> ({PET_SIZES[petSize].weight}) · {petPlacement(mode, petSize)}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between p-6">
        <span className="font-semibold text-ink-soft">Total</span>
        <motion.span key={quote.total} initial={{ scale: 1.15, color: '#0284c7' }} animate={{ scale: 1, color: '#0b2239' }} className="font-display text-3xl font-bold tabular-nums">
          {inr(quote.total)}
        </motion.span>
      </div>
      {children && <div className="px-6 pb-6">{children}</div>}
    </Card>
  )
}
