import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, BadgeCheck, ChevronDown, Globe2, MapPin, PawPrint, Plane, Quote, Search, Sparkles, Star, Syringe, Ticket, TicketPercent, TrainFront, XCircle } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { OfferCard } from '../components/Offers'
import { SearchWidget } from '../components/SearchWidget'
import { DriftingClouds, FlightPath } from '../components/Sky'
import { EASE, Reveal, SectionHeading } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { generateTrips } from '../lib/data'
import { addDays, cn, fmtDate, inr, todayISO } from '../lib/format'
import { OFFERS } from '../lib/offers'
import { averageRating, REVIEWS } from '../lib/reviews'
import { defaultSearch, searchUrl } from '../lib/search'

export default function Home() {
  return (
    <main className="overflow-x-clip">
      <Hero />
      <Offers />
      <Destinations />
      <PetSection />
      <Services />
      <Reviews />
      <HowItWorks />
      <Faq />
      <Cta />
    </main>
  )
}

const fromPrice = (from: string, to: string) => {
  const trips = generateTrips('flight', from, to, addDays(todayISO(), 7))
  return trips.length ? Math.min(...trips.map((t) => t.classes[0].price)) : 0
}

// ------------------------------------------------------------------ hero

const SLIDES = [
  { img: '/images/hero/swiss-alps.jpg', place: 'Swiss Alps', country: 'Switzerland', to: 'ZRH' },
  { img: '/images/hero/maldives.jpg', place: 'Overwater villas', country: 'Maldives', to: 'MLE' },
  { img: '/images/hero/santorini.jpg', place: 'Santorini', country: 'Greece', to: 'JTR' },
  { img: '/images/hero/kerala.jpg', place: 'Kerala backwaters', country: 'India', to: 'COK' },
  { img: '/images/hero/bali.jpg', place: 'Ulun Danu temple', country: 'Bali, Indonesia', to: 'DPS' },
]
const SLIDE_MS = 6500

function Hero() {
  const [idx, setIdx] = useState(0)
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), SLIDE_MS)
    return () => clearInterval(id)
  }, [idx])

  const slide = SLIDES[idx]

  return (
    <section ref={ref} className="relative isolate min-h-[100svh] overflow-hidden bg-sky-900 pb-16 pt-28 sm:pt-36">
      {/* Every slide stays mounted (so images are preloaded); only opacity and a slow Ken Burns zoom change. */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 -z-10">
        {SLIDES.map((s, i) => {
          const active = i === idx
          return (
            <motion.img
              key={s.img}
              src={s.img}
              alt={`${s.place}, ${s.country}`}
              fetchPriority={i === 0 ? 'high' : 'low'}
              className="absolute inset-0 h-full w-full object-cover"
              initial={false}
              animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 1.14 }}
              transition={{ opacity: { duration: 1.6, ease: 'easeInOut' }, scale: { duration: active ? SLIDE_MS / 1000 + 1.6 : 0, delay: active ? 0 : 1.6, ease: 'linear' } }}
            />
          )
        })}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-950/65 via-sky-900/30 to-sky-950/65" />
        <div className="absolute inset-0 bg-sky-400/10 mix-blend-soft-light" />
        <FlightPath scale={1.5} />
      </motion.div>

      <motion.div style={{ opacity: textOpacity }} className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur-md"
        >
          <PawPrint size={15} className="text-amber-300" /> Flights & trains · pets welcome on board
        </motion.p>
        <h1 className="mt-6 font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(8,47,73,0.45)] sm:text-6xl lg:text-7xl">
          {['Your', 'next', 'adventure', 'starts', 'here.'].map((w, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.15 + i * 0.08 }}
              className={cn('mr-[0.25em] inline-block', i >= 2 && 'bg-gradient-to-r from-cyan-200 to-sky-300 bg-clip-text text-transparent')}
            >
              {w}
            </motion.span>
          ))}
        </h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.7 }} className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-sky-50 drop-shadow-[0_2px_10px_rgba(8,47,73,0.6)] sm:text-xl">
          From the Swiss Alps to Kerala's backwaters, book flights and trains in one place, and bring the whole family, paws included.
        </motion.p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.9 }} className="relative z-20 mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <SearchWidget />
      </motion.div>

      <div className="relative z-10 mx-auto mt-8 flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div key={slide.img} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5 }} className="text-white">
            <p className="flex items-center gap-1.5 text-sm text-sky-100">
              <MapPin size={14} /> {slide.country}
            </p>
            <Link to={searchUrl(defaultSearch({ to: slide.to, from: slide.to === 'BLR' ? 'DEL' : 'BLR' }))} className="group flex items-center gap-2 font-display text-xl font-bold">
              {slide.place}
              <span className="rounded-full bg-white/20 px-3 py-0.5 text-sm backdrop-blur transition group-hover:bg-white group-hover:text-sky-700">from {inr(fromPrice('BLR', slide.to))}</span>
            </Link>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-2">
          {SLIDES.map((s, i) => (
            <button key={s.img} onClick={() => setIdx(i)} aria-label={`Show ${s.place}`} className="group relative h-1.5 w-10 overflow-hidden rounded-full bg-white/30 sm:w-14">
              {i === idx && <motion.span key={idx} className="absolute inset-y-0 left-0 bg-white" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: SLIDE_MS / 1000, ease: 'linear' }} />}
              {i < idx && <span className="absolute inset-0 bg-white/70" />}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ offers

function Offers() {
  return (
    <section className="bg-gradient-to-b from-sky-50 to-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="Special offers" title={<>Deals worth <span className="text-sky-gradient">packing for</span></>} sub="Copy a code and apply it at payment." />
          <Reveal>
            <Link to="/offers" className="group inline-flex items-center gap-2 font-bold text-sky-700">
              All offers <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
        <div className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {OFFERS.slice(0, 4).map((o, i) => (
            <Reveal key={o.code} delay={i * 0.08} className="w-[80vw] shrink-0 snap-start sm:w-auto">
              <OfferCard offer={o} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ destinations

const INDIA = [
  { code: 'AGR', name: 'Agra', tag: 'The Taj at sunrise', img: '/images/agra.jpg', className: 'md:col-span-2 md:row-span-2' },
  { code: 'GOI', name: 'Goa', tag: 'Beaches & palms', img: '/images/goa.jpg', className: '' },
  { code: 'JAI', name: 'Jaipur', tag: 'The Pink City', img: '/images/jaipur.jpg', className: '' },
  { code: 'BOM', name: 'Mumbai', tag: 'Gateway of India', img: '/images/mumbai.jpg', className: '' },
  { code: 'DEL', name: 'New Delhi', tag: 'India Gate at dusk', img: '/images/delhi.jpg', className: '' },
]
const WORLD = [
  { code: 'MLE', name: 'Maldives', tag: 'Turquoise lagoons', img: '/images/male.jpg', className: 'md:col-span-2 md:row-span-2' },
  { code: 'DXB', name: 'Dubai', tag: 'Skyline at sunset', img: '/images/dubai.jpg', className: '' },
  { code: 'SIN', name: 'Singapore', tag: 'Marina Bay', img: '/images/singapore.jpg', className: '' },
  { code: 'ZRH', name: 'Switzerland', tag: 'Alpine villages', img: '/images/zurich.jpg', className: '' },
  { code: 'DPS', name: 'Bali', tag: 'Temples on the lake', img: '/images/hero/bali.jpg', className: '' },
]

function Destinations() {
  const [tab, setTab] = useState<'india' | 'world'>('india')
  const list = tab === 'india' ? INDIA : WORLD
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="Popular right now" title="Where to next?" sub="Fares from Bengaluru, a week from today." />
          <div className="flex rounded-2xl bg-sky-50 p-1 ring-1 ring-sky-100">
            {([
              ['india', 'India', MapPin],
              ['world', 'International', Globe2],
            ] as const).map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTab(t)} className={cn('relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition', tab === t ? 'text-white' : 'text-ink-soft')}>
                {tab === t && <motion.span layoutId="dest-tab" className="absolute inset-0 rounded-xl bg-sky-500" />}
                <span className="relative flex items-center gap-2">
                  <Icon size={15} /> {label}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-10 grid auto-rows-[15rem] gap-4 md:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {list.map((d, i) => {
              const from = d.code === 'BLR' ? 'DEL' : 'BLR'
              return (
                <motion.div key={d.code} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.5, ease: EASE, delay: i * 0.05 }} className={d.className}>
                  <Link to={searchUrl(defaultSearch({ from, to: d.code }))} className="group relative block h-full overflow-hidden rounded-[28px]">
                    <img src={d.img} alt={d.tag} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-6 text-white">
                      <div>
                        <p className="text-sm font-medium text-white/80">{d.tag}</p>
                        <h3 className="font-display text-2xl font-bold">{d.name}</h3>
                      </div>
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold backdrop-blur transition group-hover:bg-white group-hover:text-sky-700">from {inr(fromPrice(from, d.code))}</span>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ pets

function PetSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const dogY = useTransform(scrollYProgress, [0, 1], [60, -60])
  const catY = useTransform(scrollYProgress, [0, 1], [-30, 90])

  const rules = [
    { icon: Plane, title: 'Flights', text: 'Small pets (up to 8 kg) fly in-cabin in dedicated pet rows. Larger pets travel in a climate-controlled hold.' },
    { icon: TrainFront, title: 'Trains', text: 'A dedicated pet coach with 4-berth cabins. You and your pet always share the same cabin.' },
    { icon: Syringe, title: 'Health check', text: 'Rabies vaccination must be within the last 12 months. We check it before confirming.' },
    { icon: BadgeCheck, title: 'Fair pet fares', text: 'Pet fares depend on size and distance, and you see the exact amount before paying.' },
  ]

  return (
    <section ref={ref} id="pets" className="relative scroll-mt-20 overflow-hidden bg-gradient-to-b from-white via-amber-50/40 to-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="relative mx-auto h-[30rem] w-full max-w-lg sm:h-[34rem]">
          <motion.div style={{ y: dogY }} className="absolute left-0 top-0 h-[78%] w-[68%] overflow-hidden rounded-[32px] shadow-float ring-8 ring-white">
            <img src="/images/pet-dog.jpg" alt="French bulldog in a yellow hoodie" className="h-full w-full object-cover" loading="lazy" />
          </motion.div>
          <motion.div style={{ y: catY }} className="absolute bottom-0 right-0 h-[52%] w-[56%] overflow-hidden rounded-[32px] shadow-float ring-8 ring-white">
            <img src="/images/pet-cat.jpg" alt="Black and white cat resting its paws" className="h-full w-full object-cover" loading="lazy" />
          </motion.div>
          <FloatingChip className="right-2 top-10" delay={0.2} icon={<Syringe size={15} className="text-emerald-500" />} text="Vaccination verified" />
          <FloatingChip className="-left-2 bottom-24 sm:-left-8" delay={0.4} icon={<TrainFront size={15} className="text-sky-500" />} text="Coach P1 · Cabin 3" />
          <FloatingChip className="bottom-4 left-24" delay={0.6} icon={<PawPrint size={15} className="text-paw" />} text="Pet pass issued" />
        </div>

        <div>
          <SectionHeading eyebrow="Pets travel too" title={<>Your pet isn't luggage. <span className="text-amber-500">They're family.</span></>} sub="Most booking sites ignore pets. We treat them as travellers, with their own seat rules, health checks and boarding pass." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {rules.map((r, i) => (
              <Reveal key={r.title} delay={i * 0.08}>
                <div className="h-full rounded-3xl bg-white p-5 shadow-soft ring-1 ring-amber-100">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-paw-soft text-amber-600">
                    <r.icon size={19} />
                  </span>
                  <h3 className="mt-3 font-display font-bold text-ink">{r.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{r.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <Link to={searchUrl(defaultSearch({ mode: 'train', pet: 'medium' }))} className="group mt-8 inline-flex items-center gap-2 rounded-2xl bg-paw px-6 py-3.5 font-bold text-white shadow-[0_14px_30px_-10px_rgb(245_158_11/0.7)] transition hover:-translate-y-0.5">
              Plan a pet-friendly trip <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function FloatingChip({ className, icon, text, delay }: { className: string; icon: ReactNode; text: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ type: 'spring', delay, stiffness: 200, damping: 16 }} className={cn('absolute z-10', className)}>
      <div className="float-y flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 text-sm font-bold text-ink shadow-float ring-1 ring-sky-100 backdrop-blur" style={{ animationDelay: `${delay * 3}s` }}>
        {icon} {text}
      </div>
    </motion.div>
  )
}

// ------------------------------------------------------------------ services (PNR status)

interface PnrStatus {
  pnr: string
  legs: { operator: string; number: string; date: string; from: string; to: string; status: 'CONFIRMED' | 'WAITLIST' | 'CANCELLED'; waitlistNo?: number; seats: string[] }[]
}

function Services() {
  const [pnr, setPnr] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<ReactNode>(null)

  const check = async (e: FormEvent) => {
    e.preventDefault()
    const code = pnr.trim().toUpperCase()
    if (!code) return
    setChecking(true)
    try {
      const b = await api<PnrStatus>(`/pnr/${encodeURIComponent(code)}`)
      setResult(
        <div className="space-y-2">
          {b.legs.map((l, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-sm">
              <span className="font-semibold text-ink">
                {l.from} → {l.to} · {l.operator} {l.number} · {fmtDate(l.date)}
              </span>
              <span className={cn('rounded-full px-3 py-1 text-xs font-bold', l.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : l.status === 'WAITLIST' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600')}>
                {l.status === 'WAITLIST' ? `Waitlist ${l.waitlistNo}` : l.status === 'CONFIRMED' ? `Confirmed · ${l.seats.join(', ')}` : 'Cancelled'}
              </span>
            </div>
          ))}
          <Link to={`/ticket/${b.pnr}`} className="inline-flex items-center gap-1 text-sm font-bold text-sky-700">
            View e-ticket <ArrowRight size={14} />
          </Link>
        </div>,
      )
    } catch (err) {
      setResult(<p className="text-sm font-semibold text-rose-500">{err instanceof ApiError && err.status === 404 ? `No booking found with PNR ${code}.` : err instanceof Error ? err.message : 'Could not check right now'}</p>)
    } finally {
      setChecking(false)
    }
  }

  const quick = [
    { icon: Ticket, title: 'My trips', text: 'View, download or print your tickets', to: '/trips' },
    { icon: XCircle, title: 'Cancel a booking', text: 'Refunds and automatic waitlist moves', to: '/trips' },
    { icon: TicketPercent, title: 'Offers & coupons', text: 'Codes for flights, trains and pets', to: '/offers' },
  ]

  return (
    <section id="services" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8">
        <Reveal>
          <div className="relative h-full overflow-hidden rounded-[32px] bg-gradient-to-br from-sky-500 to-sky-700 p-8 text-white shadow-float">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold">Check PNR status</h2>
              <p className="mt-2 text-sky-50/90">Enter your PNR to see live status for every leg of your journey.</p>
              <form onSubmit={check} className="mt-6 flex gap-2 rounded-2xl bg-white p-1.5">
                <input value={pnr} onChange={(e) => setPnr(e.target.value)} placeholder="e.g. 463E87 or 9067073734" className="min-w-0 flex-1 rounded-xl px-4 font-mono text-ink outline-none placeholder:font-sans placeholder:text-ink-soft/60" aria-label="PNR number" />
                <button disabled={checking} className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-600 disabled:opacity-60">
                  <Search size={16} /> {checking ? 'Checking…' : 'Check'}
                </button>
              </form>
              <AnimatePresence mode="wait">
                {result && (
                  <motion.div key={pnr} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-white p-4">
                    {result}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
        <div className="grid gap-4">
          {quick.map((q, i) => (
            <Reveal key={q.title} delay={i * 0.08}>
              <Link to={q.to} className="group flex items-center gap-4 rounded-3xl bg-sky-50/70 p-5 ring-1 ring-sky-100 transition hover:bg-white hover:shadow-soft">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-sky-600 shadow-soft">
                  <q.icon size={21} />
                </span>
                <span className="flex-1">
                  <span className="block font-display font-bold text-ink">{q.title}</span>
                  <span className="block text-sm text-ink-soft">{q.text}</span>
                </span>
                <ArrowRight size={18} className="text-sky-500 transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ reviews

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(n) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
      ))}
    </span>
  )
}

const AVATAR_TONES = ['from-sky-400 to-sky-600', 'from-amber-300 to-orange-500', 'from-teal-300 to-teal-600', 'from-indigo-300 to-indigo-600', 'from-rose-300 to-rose-500', 'from-cyan-300 to-sky-600']

function Reviews() {
  const avg = averageRating()
  return (
    <section id="reviews" className="scroll-mt-20 overflow-hidden bg-gradient-to-b from-white to-sky-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="Traveller ratings" title="Loved by travellers (and their pets)" />
          <Reveal>
            <div className="flex items-center gap-4 rounded-3xl bg-white px-6 py-4 shadow-soft ring-1 ring-sky-100">
              <span className="font-display text-4xl font-extrabold text-ink">{avg.toFixed(1)}</span>
              <span>
                <Stars n={avg} />
                <span className="mt-1 block text-xs text-ink-soft">Average of {REVIEWS.length} sample reviews</span>
              </span>
            </div>
          </Reveal>
        </div>
        <div className="mt-12 columns-1 gap-5 sm:columns-2 lg:columns-3">
          {REVIEWS.map((r, i) => (
            <Reveal key={r.name} delay={(i % 3) * 0.08} className="mb-5 break-inside-avoid">
              <figure className="relative rounded-[26px] bg-white p-6 shadow-soft ring-1 ring-sky-100">
                <Quote className="absolute right-5 top-5 text-sky-100" size={36} />
                <Stars n={r.rating} />
                <blockquote className="mt-4 leading-relaxed text-ink">“{r.text}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className={cn('grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br font-bold text-white', AVATAR_TONES[i % AVATAR_TONES.length])}>{r.name[0]}</span>
                  <span className="min-w-0">
                    <span className="block font-bold text-ink">{r.name}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {r.city} · {r.trip}
                    </span>
                  </span>
                </figcaption>
                {r.pet && (
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-paw-soft px-3 py-1 text-xs font-bold text-amber-800">
                    <PawPrint size={12} /> Travelled with {r.pet}
                  </span>
                )}
              </figure>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-ink-soft">Sample reviews shown for this demo.</p>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ how it works

const STEPS = [
  { title: 'Search', text: 'One way or round trip, flights or trains, with special fares, quotas and your pet.' },
  { title: 'Pick your seats', text: 'Window, aisle, lower berth or a pet-friendly cabin. Your choice.' },
  { title: 'Add travellers & pets', text: "Adults, children, infants and your pet's profile with its vaccination date." },
  { title: 'Pay & go', text: 'Apply a coupon, pay securely and get boarding passes and a pet pass instantly.' },
]

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] })

  return (
    <section id="how" className="scroll-mt-20 bg-sky-50 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-16 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:px-8">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading eyebrow="How it works" title="Four steps from idea to boarding pass." />
        </div>
        <div ref={ref} className="relative pl-12">
          <div className="absolute bottom-6 left-[19px] top-6 w-0.5 rounded bg-sky-100" />
          <motion.div style={{ scaleY: scrollYProgress }} className="absolute bottom-6 left-[19px] top-6 w-0.5 origin-top rounded bg-gradient-to-b from-sky-400 to-sky-600" />
          <ol className="space-y-8">
            {STEPS.map((s, i) => (
              <Reveal key={s.title}>
                <li className="relative">
                  <span className="absolute -left-12 grid h-10 w-10 place-items-center rounded-full bg-white font-display font-bold text-sky-600 shadow-soft ring-2 ring-sky-200">{i + 1}</span>
                  <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-sky-100">
                    <h3 className="font-display text-xl font-bold text-ink">{s.title}</h3>
                    <p className="mt-2 leading-relaxed text-ink-soft">{s.text}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ faq

const FAQS = [
  { q: 'Can my dog travel with me on the train?', a: 'Yes. Choose the Pet Coach class on any pet-friendly train. Each cabin has 4 berths and a pet zone, and we keep your whole party and your pet in one cabin.' },
  { q: 'Which pets can fly in the cabin?', a: 'Pets up to 8 kg (including the carrier) fly in-cabin, with their owner in one of the pet rows. Bigger pets fly in a climate-controlled, pressurised hold.' },
  { q: 'Do children and infants need their own seat?', a: 'Children (2–11) get their own seat. Infants under 2 travel on an adult’s lap: a small flat fee on flights, free on trains.' },
  { q: 'What are special fares and quotas?', a: 'On flights, students, senior citizens and armed forces personnel get a discount on the base fare (ID needed at check-in). On trains you can book under General, Tatkal, Ladies or Senior citizen quota.' },
  { q: 'How does the train waitlist work?', a: 'If a class is full you can still book with a waitlist number. When someone cancels, the earliest waitlisted booking that fits is confirmed automatically.' },
  { q: 'How do I use a coupon?', a: 'Copy a code from the Offers page and enter it on the payment step. The discount shows in the fare summary before you pay.' },
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading center eyebrow="Questions" title="Good to know" />
        <div className="mt-12 space-y-3">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.04}>
              <div className={cn('rounded-3xl ring-1 transition', open === i ? 'bg-sky-50/70 ring-sky-200' : 'bg-white ring-sky-100')}>
                <button className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-display font-bold text-ink" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  {f.q}
                  <ChevronDown size={20} className={cn('shrink-0 text-sky-500 transition-transform', open === i && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                      <p className="px-6 pb-6 leading-relaxed text-ink-soft">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ cta

function Cta() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-120px' })
  return (
    <section className="bg-white px-4 pb-24 sm:px-6 lg:px-8">
      <div ref={ref} className="relative mx-auto max-w-7xl overflow-hidden rounded-[40px] bg-gradient-to-br from-sky-400 via-sky-500 to-sky-700 px-6 py-20 text-center text-white shadow-float sm:px-16">
        <DriftingClouds />
        <FlightPath start={inView} d="M -160 640 C 300 560 600 300 900 330 S 1300 160 1640 120" delay={0.2} duration={4} scale={0.9} />
        <div className="relative">
          <Sparkles className="mx-auto text-sky-100" />
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">Your next trip is a few taps away.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-sky-50/90">Create a free account to keep all your tickets in one place.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="rounded-2xl bg-white px-7 py-4 font-bold text-sky-700 shadow-float transition hover:-translate-y-0.5">
              Create account
            </Link>
            <Link to={searchUrl(defaultSearch())} className="group inline-flex items-center gap-2 rounded-2xl bg-white/15 px-7 py-4 font-bold text-white ring-1 ring-white/40 backdrop-blur transition hover:bg-white/25">
              Start booking <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
