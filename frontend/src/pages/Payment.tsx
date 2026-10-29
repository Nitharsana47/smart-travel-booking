import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, CreditCard, Lock, ShieldCheck, Smartphone, TicketPercent, X } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FareSummary, HoldTimer, Stepper, TripHeader } from '../components/BookingParts'
import { PlaneDefs, PlaneGlyph } from '../components/Sky'
import { Button, Card, PageShell } from '../components/ui'
import { cn, inr } from '../lib/format'
import { ApiError } from '../lib/api'
import { OFFERS } from '../lib/offers'
import { useDraft } from '../lib/useDraft'
import { useBooking } from '../store/booking'
import { useToast } from '../store/toast'

const input = 'w-full rounded-2xl bg-sky-50/60 px-4 py-3 font-medium text-ink outline-none ring-1 ring-sky-100 transition placeholder:text-ink-soft/50 focus:bg-white focus:ring-2 focus:ring-sky-400'

/** Luhn checksum: catches typos in card numbers. */
function luhn(num: string) {
  let sum = 0
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i])
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2
    sum += d
  }
  return num.length >= 12 && sum % 10 === 0
}

export default function Payment() {
  const ctx = useDraft()
  const confirm = useBooking((s) => s.confirm)
  const update = useBooking((s) => s.update)
  const toast = useToast((s) => s.push)
  const [code, setCode] = useState('')
  // One key per checkout: if the request is retried (double click, flaky network), the server returns the same booking.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const navigate = useNavigate()
  const [method, setMethod] = useState<'card' | 'upi'>('card')
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' })
  const [upi, setUpi] = useState('')
  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  if (!ctx) return processing ? null : <Navigate to="/" replace />
  const { draft, legs, quote, seatsDone, mode } = ctx
  if (!seatsDone) return <Navigate to="/book/seats" replace />
  const waitlist = legs.every((l) => l.waitlist)
  const applyCode = (c: string) => update({ coupon: c.trim().toUpperCase() || null })
  const suggestions = OFFERS.filter((o) => !o.mode || o.mode === mode)

  const digits = card.number.replace(/\D/g, '')
  const pretty = (digits + '•'.repeat(Math.max(0, 16 - digits.length))).replace(/(.{4})/g, '$1 ').trim()

  const pay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (draft.holdUntil && draft.holdUntil < Date.now()) return
    if (method === 'card') {
      const [mm, yy] = card.expiry.split('/').map(Number)
      const now = new Date()
      const expired = !mm || mm > 12 || !yy || 2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1)
      if (!luhn(digits)) return setError('That card number looks wrong. Try the test card 4111 1111 1111 1111.')
      if (card.name.trim().length < 2) return setError('Enter the name on the card.')
      if (expired) return setError('Card expiry must be a future month (MM/YY).')
      if (!/^\d{3}$/.test(card.cvv)) return setError('CVV is the 3 digits on the back.')
    } else if (!/^[\w.-]{2,}@[a-z]{2,}$/i.test(upi)) {
      return setError('Enter a UPI ID like name@okbank.')
    }
    setError('')
    setProcessing(true)
    // Simulated gateway: only the last 4 digits are ever sent or stored, never the full card.
    const ref = method === 'card' ? `•••• ${digits.slice(-4)}` : upi
    const started = Date.now()
    try {
      const booking = await confirm(quote, { method, ref }, idempotencyKey)
      await new Promise((r) => setTimeout(r, Math.max(0, 1600 - (Date.now() - started)))) // let the animation finish
      navigate(`/ticket/${booking.pnr}`, { replace: true })
    } catch (err) {
      setProcessing(false)
      const status = err instanceof ApiError ? err.status : 0
      const msg = err instanceof Error ? err.message : 'Payment failed'
      if (status === 409) {
        toast(msg, 'warn')
        await useBooking.getState().release()
        navigate('/book/seats')
      } else if (status === 422) {
        toast('Please check the traveller details', 'warn')
        navigate('/book/details')
      } else setError(msg)
    }
  }

  return (
    <PageShell>
      <Stepper current={2} />
      <div className="mx-auto mt-10 grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
        <div className="min-w-0 space-y-6">
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 space-y-4">
              {legs.map((l, i) => (
                <TripHeader key={i} trip={l.trip} cls={l.cls} label={legs.length > 1 ? (i === 0 ? 'Outbound' : 'Return') : undefined} />
              ))}
            </div>
            <HoldTimer />
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">Payment</h2>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <ShieldCheck size={16} /> Secure test checkout
              </span>
            </div>
            <div className="mt-5 flex gap-2 rounded-2xl bg-sky-50 p-1 ring-1 ring-sky-100">
              {([
                ['card', 'Card', CreditCard],
                ['upi', 'UPI', Smartphone],
              ] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m)
                    setError('')
                  }}
                  className={cn('relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition', method === m ? 'text-sky-700' : 'text-ink-soft')}
                >
                  {method === m && <motion.span layoutId="pay-pill" className="absolute inset-0 rounded-xl bg-white shadow-soft" />}
                  <span className="relative flex items-center gap-2">
                    <Icon size={16} /> {label}
                  </span>
                </button>
              ))}
            </div>

            <form onSubmit={pay} className="mt-6">
              <AnimatePresence mode="wait" initial={false}>
                {method === 'card' ? (
                  <motion.div key="card" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="grid items-center gap-8 md:grid-cols-[1fr_18rem]">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">Card number</span>
                        <input
                          className={cn(input, 'font-mono tracking-wider')}
                          inputMode="numeric"
                          autoComplete="cc-number"
                          placeholder="4111 1111 1111 1111"
                          value={card.number}
                          onChange={(e) => setCard({ ...card, number: e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ') })}
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">Name on card</span>
                        <input className={input} autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="As printed" />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">Expiry</span>
                        <input
                          className={cn(input, 'font-mono')}
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          placeholder="MM/YY"
                          value={card.expiry}
                          onChange={(e) => {
                            const d = e.target.value.replace(/\D/g, '').slice(0, 4)
                            setCard({ ...card, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d })
                          }}
                        />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">CVV</span>
                        <input
                          className={cn(input, 'font-mono')}
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          type="password"
                          placeholder="•••"
                          value={card.cvv}
                          onFocus={() => setFlipped(true)}
                          onBlur={() => setFlipped(false)}
                          onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                        />
                      </label>
                    </div>

                    <div className="mx-auto w-72 [perspective:1000px]">
                      <motion.div animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 120, damping: 16 }} className="relative h-44 [transform-style:preserve-3d]">
                        <div className="absolute inset-0 overflow-hidden rounded-3xl bg-gradient-to-br from-sky-400 via-sky-600 to-indigo-700 p-5 text-white shadow-float [backface-visibility:hidden]">
                          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15" />
                          <div className="absolute -bottom-16 -left-6 h-40 w-40 rounded-full bg-white/10" />
                          <div className="relative flex justify-between">
                            <span className="h-8 w-11 rounded-md bg-gradient-to-br from-amber-200 to-amber-400" />
                            <span className="font-display text-sm font-bold italic">SkyPay</span>
                          </div>
                          <p className="relative mt-6 font-mono text-lg tracking-widest">{pretty}</p>
                          <div className="relative mt-4 flex justify-between text-xs">
                            <span className="truncate uppercase">{card.name || 'Your name'}</span>
                            <span className="font-mono">{card.expiry || 'MM/YY'}</span>
                          </div>
                        </div>
                        <div className="absolute inset-0 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 to-sky-600 shadow-float [backface-visibility:hidden] [transform:rotateY(180deg)]">
                          <div className="mt-6 h-10 bg-ink/80" />
                          <div className="mx-5 mt-5 flex items-center justify-end rounded-md bg-white px-3 py-2 font-mono text-ink">{card.cvv.replace(/./g, '•') || 'CVV'}</div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="upi" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
                    <label>
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">UPI ID</span>
                      <input className={input} value={upi} onChange={(e) => setUpi(e.target.value.trim())} placeholder="yourname@okbank" />
                    </label>
                    <p className="mt-3 text-sm text-ink-soft">You'd normally approve the request in your UPI app. In this demo, it's approved automatically.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && <p className="mt-5 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</p>}
              <Button type="submit" className="mt-6 w-full py-4 text-base" disabled={processing}>
                <Lock size={17} /> Pay {inr(quote.total)}
              </Button>
              <p className="mt-3 text-center text-xs text-ink-soft">Demo checkout: no real money moves. Test card: 4111 1111 1111 1111, any future expiry, any CVV.</p>
            </form>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <h3 className="flex items-center gap-2 font-display font-bold">
              <TicketPercent size={18} className="text-sky-500" /> Coupon
            </h3>
            {draft.coupon && !quote.couponError ? (
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <span className="flex items-center gap-2 font-mono text-sm font-bold text-emerald-700">
                  <Check size={16} /> {draft.coupon} applied
                </span>
                <button onClick={() => update({ coupon: null })} aria-label="Remove coupon" className="grid h-7 w-7 place-items-center rounded-full text-emerald-700 hover:bg-emerald-100">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    applyCode(code)
                  }}
                  className="mt-3 flex gap-2"
                >
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter code" className="min-w-0 flex-1 rounded-xl bg-sky-50 px-3 py-2.5 font-mono text-sm uppercase outline-none ring-1 ring-sky-100 focus:ring-2 focus:ring-sky-400" />
                  <button className="rounded-xl bg-sky-500 px-4 text-sm font-bold text-white hover:bg-sky-600">Apply</button>
                </form>
                {draft.coupon && quote.couponError && <p className="mt-2 text-xs font-semibold text-rose-500">{quote.couponError}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {suggestions.map((o) => (
                    <button key={o.code} onClick={() => applyCode(o.code)} title={o.title} className="rounded-lg border border-dashed border-sky-300 px-2 py-1 font-mono text-[11px] font-bold text-sky-700 hover:bg-sky-50">
                      {o.code}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>
          <FareSummary quote={quote} petSize={draft.petSize} mode={mode}>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/book/details')}>
              <ArrowLeft size={16} /> Edit travellers
            </Button>
          </FareSummary>
        </aside>
      </div>

      <AnimatePresence>{processing && <Processing waitlist={waitlist} />}</AnimatePresence>
    </PageShell>
  )
}

function Processing({ waitlist }: { waitlist: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] grid place-items-center bg-gradient-to-b from-sky-300/90 to-white/95 backdrop-blur-md">
      <div className="text-center">
        <svg viewBox="-120 -60 240 120" className="mx-auto h-40 w-80" aria-hidden>
          <PlaneDefs />
          <motion.circle r="52" fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="6 10" animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }} />
          <motion.g animate={{ y: [-4, 4, -4], rotate: [-3, 3, -3] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            <PlaneGlyph scale={0.9} />
          </motion.g>
        </svg>
        <h2 className="font-display text-2xl font-bold text-ink">{waitlist ? 'Adding you to the waitlist…' : 'Confirming your seats…'}</h2>
        <p className="mt-2 text-ink-soft">Processing payment and issuing your tickets</p>
        <div className="mx-auto mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-white">
          <motion.div className="h-full rounded-full bg-sky-500" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 2.1, ease: 'easeInOut' }} />
        </div>
      </div>
    </motion.div>
  )
}
