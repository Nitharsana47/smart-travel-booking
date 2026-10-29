import { motion } from 'framer-motion'
import { ClipboardCopy, CreditCard, Search } from 'lucide-react'
import { OfferCard } from '../components/Offers'
import { DriftingClouds } from '../components/Sky'
import { EASE, Reveal } from '../components/ui'
import { OFFERS } from '../lib/offers'

const HOW = [
  { icon: ClipboardCopy, title: 'Copy a code', text: 'Pick an offer below and tap “Copy code”.' },
  { icon: Search, title: 'Book your trip', text: 'Search, choose seats and add your travellers as usual.' },
  { icon: CreditCard, title: 'Apply at payment', text: 'Paste the code in the Coupon box and see the discount instantly.' },
]

export default function OffersPage() {
  return (
    <main className="min-h-screen bg-sky-50/60 pb-24">
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-500 to-sky-400 pb-24 pt-32 text-white">
        <DriftingClouds dim />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold uppercase tracking-[0.2em] text-sky-100">
            Special offers
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE, duration: 0.7, delay: 0.1 }} className="mt-3 max-w-2xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">
            Travel more, spend less.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE, duration: 0.7, delay: 0.2 }} className="mt-4 max-w-xl text-lg text-sky-50">
            Coupons for flights, trains, round trips, international getaways and your four-legged co-traveller.
          </motion.p>
        </div>
      </section>

      <div className="relative mx-auto -mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 rounded-[28px] bg-white p-5 shadow-float ring-1 ring-sky-100 sm:grid-cols-3">
          {HOW.map((h, i) => (
            <div key={h.title} className="flex items-start gap-3 p-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 font-display font-bold text-sky-600">{i + 1}</span>
              <span>
                <span className="flex items-center gap-1.5 font-bold text-ink">
                  <h.icon size={15} className="text-sky-500" /> {h.title}
                </span>
                <span className="block text-sm text-ink-soft">{h.text}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {OFFERS.map((o, i) => (
            <Reveal key={o.code} delay={(i % 3) * 0.08}>
              <OfferCard offer={o} />
            </Reveal>
          ))}
        </div>
      </div>
    </main>
  )
}
