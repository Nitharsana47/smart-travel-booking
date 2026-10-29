import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import { Download, Home, ListOrdered, Loader2, Luggage, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Stepper } from '../components/BookingParts'
import { PassengerTicket, PetPass } from '../components/Tickets'
import { Button, EASE, PageShell } from '../components/ui'
import { api } from '../lib/api'
import { inr } from '../lib/format'
import { isCancelled, useBooking, type Booking } from '../store/booking'
import { useToast } from '../store/toast'

export default function Ticket() {
  const { pnr } = useParams()
  const cached = useBooking((s) => s.bookings.find((b) => b.pnr === pnr))
  const [fetched, setFetched] = useState<Booking | null | 'missing'>(null)
  const toast = useToast((s) => s.push)
  const sheet = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (cached || !pnr) return
    api<{ booking: Booking }>(`/bookings/${pnr}`)
      .then((r) => setFetched(r.booking))
      .catch(() => setFetched('missing'))
  }, [cached, pnr])

  const booking = cached ?? (fetched && fetched !== 'missing' ? fetched : null)
  if (!booking && fetched !== 'missing') {
    return (
      <PageShell className="grid place-items-center">
        <Loader2 className="animate-spin text-sky-500" size={32} />
      </PageShell>
    )
  }
  if (!booking) {
    return (
      <PageShell className="grid place-items-center">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold">Ticket not found</h1>
          <p className="mt-2 text-ink-soft">We couldn't find PNR {pnr} in your account.</p>
          <Link to="/trips" className="mt-6 inline-block font-bold text-sky-600">
            Go to my trips →
          </Link>
        </div>
      </PageShell>
    )
  }

  const first = booking.passengers[0]?.name.split(' ')[0] || 'traveller'
  const cancelled = isCancelled(booking)
  const waitlisted = !cancelled && booking.legs.some((l) => l.status === 'WAITLIST')
  const seated = booking.passengers.filter((p) => p.type !== 'Infant')
  const infants = booking.passengers.filter((p) => p.type === 'Infant')
  const round = booking.legs.length > 1

  const download = async () => {
    if (!sheet.current) return
    setSaving(true)
    try {
      const url = await toPng(sheet.current, { pixelRatio: 2, backgroundColor: '#f0f9ff', cacheBust: true })
      const a = document.createElement('a')
      a.href = url
      a.download = `SkyVoyage-${booking.pnr}.png`
      a.click()
    } catch {
      toast("Couldn't create the image. Try Print → Save as PDF instead.", 'warn')
    } finally {
      setSaving(false)
    }
  }

  let delay = 0.4
  const nextDelay = () => (delay += 0.12)

  return (
    <PageShell className="bg-sky-50">
      <Stepper current={4} />
      <div className="mx-auto mt-10 max-w-4xl px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE, duration: 0.6 }} className="no-print text-center">
          <svg viewBox="0 0 80 80" className="mx-auto h-20 w-20" aria-hidden>
            <motion.circle cx="40" cy="40" r="36" fill={cancelled ? '#ffe4e6' : waitlisted ? '#fef3c7' : '#dcfce7'} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }} style={{ originX: '50%', originY: '50%' }} />
            {waitlisted || cancelled ? (
              <motion.path d="M40 22 V42 M40 52 V54" stroke={cancelled ? '#e11d48' : '#d97706'} strokeWidth="6" strokeLinecap="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3, duration: 0.5 }} />
            ) : (
              <motion.path d="M25 41 L35 51 L56 30" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3, duration: 0.5 }} />
            )}
          </svg>
          <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{cancelled ? 'This booking was cancelled' : waitlisted ? `You're on the waitlist, ${first}` : `You're all set, ${first}!`}</h1>
          <p className="mx-auto mt-2 max-w-xl text-ink-soft">
            {waitlisted
              ? "You'll be confirmed automatically if seats free up."
              : `Paid ${inr(booking.quote.total)} via ${booking.payment.method === 'card' ? `card ${booking.payment.ref}` : booking.payment.ref}. Tickets would also be emailed to ${booking.contact.email}.`}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={download} disabled={saving}>
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} Download
            </Button>
            <Button variant="soft" onClick={() => window.print()}>
              <Printer size={17} /> Print / PDF
            </Button>
            <Link to="/trips" className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-ink-soft transition hover:bg-white">
              <ListOrdered size={17} /> My trips
            </Link>
          </div>
        </motion.div>

        <div ref={sheet} className="mt-10 space-y-6 bg-sky-50 p-1">
          {booking.legs.map((leg, li) => (
            <section key={li} className="space-y-6">
              {round && <h2 className="font-display text-lg font-bold text-ink">{li === 0 ? 'Outbound journey' : 'Return journey'}</h2>}
              {seated.map((p, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 40, rotateX: -20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ ease: EASE, duration: 0.8, delay: nextDelay() }} style={{ transformPerspective: 1200 }}>
                  <PassengerTicket booking={booking} leg={leg} passenger={p} index={i} infant={infants[i]} label={round ? (li === 0 ? 'Outbound' : 'Return') : undefined} />
                </motion.div>
              ))}
            </section>
          ))}
          {booking.pet && (
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE, duration: 0.8, delay: nextDelay() }}>
              <PetPass booking={booking} />
            </motion.div>
          )}
        </div>

        <div className="no-print mt-10 grid gap-4 sm:grid-cols-2">
          <div className="flex gap-3 rounded-3xl bg-white p-5 ring-1 ring-sky-100">
            <Luggage className="shrink-0 text-sky-500" />
            <p className="text-sm text-ink-soft">
              {booking.mode === 'flight' ? 'Bag drop closes 45 minutes before departure. Keep this QR code ready at security.' : 'Carry a valid photo ID. The chart is prepared 4 hours before departure.'}
            </p>
          </div>
          <Link to="/" className="flex items-center gap-3 rounded-3xl bg-white p-5 text-sm font-bold text-sky-700 ring-1 ring-sky-100 transition hover:bg-sky-50">
            <Home className="text-sky-500" /> Plan another trip
          </Link>
        </div>
      </div>
    </PageShell>
  )
}
