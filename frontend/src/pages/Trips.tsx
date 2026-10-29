import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ArrowRightLeft, LogIn, PawPrint, Plane, TicketX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { OperatorLogo } from '../components/Brand'
import { Cloud } from '../components/Sky'
import { EASE, PageShell } from '../components/ui'
import { cn, fmtDate, fmtTime, inr } from '../lib/format'
import { defaultSearch, searchUrl } from '../lib/search'
import { useCurrentUser } from '../store/auth'
import { isCancelled, useBooking, type Booking } from '../store/booking'
import { useToast } from '../store/toast'

function EmptyState({ title, text, cta }: { title: string; text: string; cta: React.ReactNode }) {
  return (
    <div className="relative mt-12 overflow-hidden rounded-[32px] bg-gradient-to-b from-sky-100 to-white p-12 text-center ring-1 ring-sky-100">
      <Cloud className="float-y absolute -left-6 top-6 w-40 opacity-80" />
      <Cloud className="float-y absolute -right-4 top-16 w-28 opacity-70" />
      <Plane className="relative mx-auto text-sky-400" size={44} />
      <h2 className="relative mt-4 font-display text-2xl font-bold">{title}</h2>
      <p className="relative mt-1 text-ink-soft">{text}</p>
      <div className="relative mt-6">{cta}</div>
    </div>
  )
}

export default function Trips() {
  const user = useCurrentUser()
  const bookings = useBooking((s) => s.bookings)
  const cancel = useBooking((s) => s.cancel)
  const loadBookings = useBooking((s) => s.loadBookings)
  const toast = useToast((s) => s.push)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Refresh on open: a waitlisted ticket may have been confirmed since.
  useEffect(() => {
    loadBookings().catch((e) => toast(e.message, 'warn'))
  }, [loadBookings, toast])

  const onCancel = async (b: Booking) => {
    setBusy(b.pnr)
    try {
      const { refund, promoted } = await cancel(b.pnr)
      toast(`PNR ${b.pnr} cancelled. ${inr(refund)} will be refunded.`, 'success')
      if (promoted.length) toast(`${promoted.length} waitlisted ${promoted.length === 1 ? 'booking was' : 'bookings were'} confirmed with the freed seats`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not cancel', 'warn')
    } finally {
      setBusy(null)
      setConfirming(null)
    }
  }

  const btn = 'inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-6 py-3.5 font-bold text-white shadow-soft transition hover:bg-sky-600'

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE }}>
          <h1 className="font-display text-4xl font-bold">My trips</h1>
          <p className="mt-2 text-ink-soft">{user ? `Bookings for ${user.email}. Cancelling refunds 85% of the fare and automatically confirms the next person on the waitlist.` : 'Sign in to see your bookings.'}</p>
        </motion.div>

        {!user ? (
          <EmptyState
            title="Sign in to view your trips"
            text="Your boarding passes and PNR status live in your account."
            cta={
              <Link to="/login?next=/trips" className={btn}>
                <LogIn size={17} /> Log in
              </Link>
            }
          />
        ) : bookings.length === 0 ? (
          <EmptyState
            title="No trips yet"
            text="Your boarding passes will appear here."
            cta={
              <Link to={searchUrl(defaultSearch())} className={btn}>
                Find a trip <ArrowRight size={17} />
              </Link>
            }
          />
        ) : (
          <ul className="mt-10 space-y-4">
            <AnimatePresence>
              {bookings.map((b, i) => {
                const first = b.legs[0].trip
                const code = (c: typeof first.from) => (b.mode === 'flight' ? c.code : c.station)
                const cancelled = isCancelled(b)
                return (
                  <motion.li key={b.pnr} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE, delay: i * 0.05 }} className={cn('rounded-3xl bg-white p-5 shadow-soft ring-1 ring-sky-100 sm:p-6', cancelled && 'opacity-60')}>
                    <div className="flex flex-wrap items-center gap-5">
                      <OperatorLogo trip={first} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
                          {code(first.from)} {b.legs.length > 1 ? <ArrowRightLeft size={16} className="text-sky-400" /> : <ArrowRight size={16} className="text-sky-400" />} {code(first.to)}
                          {b.pet && <PawPrint size={16} className="text-paw" />}
                        </p>
                        <p className="text-sm text-ink-soft">
                          {b.legs.map((l) => `${l.trip.operator} ${l.trip.number} · ${fmtDate(l.trip.date)} ${fmtTime(l.trip.depMin)}`).join('  ↔  ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {b.legs.map((l, li) => (
                            <span
                              key={li}
                              className={cn(
                                'inline-block rounded-full px-3 py-1 text-xs font-bold',
                                l.status === 'CONFIRMED' && 'bg-emerald-50 text-emerald-700',
                                l.status === 'WAITLIST' && 'bg-amber-50 text-amber-700',
                                l.status === 'CANCELLED' && 'bg-rose-50 text-rose-600',
                              )}
                            >
                              {b.legs.length > 1 && (li === 0 ? 'Out: ' : 'Ret: ')}
                              {l.status === 'WAITLIST' ? `${b.quota === 'TQ' ? 'TQWL' : 'WL'} ${l.waitlistNo}` : l.status[0] + l.status.slice(1).toLowerCase()}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 font-mono text-sm font-bold">PNR {b.pnr}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sky-50 pt-4">
                      <p className="text-sm text-ink-soft">
                        {b.passengers.length} {b.passengers.length === 1 ? 'traveller' : 'travellers'} · <b className="text-ink">{inr(b.quote.total)}</b>
                      </p>
                      <div className="flex gap-2">
                        {!cancelled &&
                          (confirming === b.pnr ? (
                            <>
                              <button onClick={() => setConfirming(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-ink-soft hover:bg-sky-50">
                                Keep
                              </button>
                              <button onClick={() => onCancel(b)} disabled={busy === b.pnr} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60">
                                {busy === b.pnr ? 'Cancelling…' : 'Yes, cancel'}
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setConfirming(b.pnr)} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-rose-500 hover:bg-rose-50">
                              <TicketX size={16} /> Cancel
                            </button>
                          ))}
                        <Link to={`/ticket/${b.pnr}`} className="rounded-xl bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 ring-1 ring-sky-100 hover:bg-sky-100">
                          View ticket
                        </Link>
                      </div>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </PageShell>
  )
}
