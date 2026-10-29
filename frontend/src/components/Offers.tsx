import { motion } from 'framer-motion'
import { Check, Copy, TicketPercent } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/format'
import type { Offer } from '../lib/offers'

export function OfferCard({ offer, className }: { offer: Offer; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(offer.code)
    } catch {
      // Clipboard can be blocked; the code is still visible on the card.
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <motion.article whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className={cn('group flex h-full flex-col overflow-hidden rounded-[26px] bg-white shadow-soft ring-1 ring-sky-100 hover:shadow-float', className)}>
      <div className="relative h-40 overflow-hidden">
        <img src={offer.img} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-sky-700 backdrop-blur">{offer.tag}</span>
        <h3 className="absolute bottom-3 left-4 right-4 font-display text-2xl font-bold text-white">{offer.title}</h3>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm leading-relaxed text-ink-soft">{offer.text}</p>
        <p className="mt-2 text-xs text-ink-soft/80">{offer.terms}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="flex items-center gap-2 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-sky-700">
            <TicketPercent size={15} /> {offer.code}
          </span>
          <button onClick={copy} className={cn('flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition', copied ? 'bg-emerald-50 text-emerald-600' : 'text-sky-700 hover:bg-sky-50')}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </div>
      </div>
    </motion.article>
  )
}
