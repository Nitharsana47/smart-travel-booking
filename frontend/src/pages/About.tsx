import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Globe2, HeartHandshake, Mail, PawPrint, ReceiptText, ShieldCheck } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../components/Brand'
import { EASE, Reveal, SectionHeading } from '../components/ui'
import { CITIES } from '../lib/data'
import { defaultSearch, searchUrl } from '../lib/search'

const VALUES = [
  { icon: PawPrint, title: 'Pets are family', text: 'Pets get their own seat rules, health checks and boarding pass, not a footnote in the terms.' },
  { icon: ReceiptText, title: 'Honest pricing', text: 'Every fee is shown line by line before you pay: base fare, pet fare, upgrades, taxes and discounts.' },
  { icon: ShieldCheck, title: 'Booking you can trust', text: 'A seat you pick is yours while you pay, and no seat is ever sold twice.' },
  { icon: Globe2, title: 'Home and away', text: 'Trains across India and flights from Indian cities to the Alps, the Maldives and beyond.' },
]

const TEAM = [
  { name: 'Nitharsana C', role: 'Full-stack & pet allocation engine' },
  { name: 'Harini U S', role: 'Booking flow & payments' },
  { name: 'Shivaroshini K', role: 'Design & user experience' },
]

export default function About() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const domestic = CITIES.filter((c) => !c.intl).length
  const abroad = CITIES.length - domestic

  return (
    <main className="overflow-x-clip bg-white">
      <section ref={ref} className="relative isolate flex min-h-[70svh] items-end overflow-hidden pb-20 pt-40">
        <motion.img style={{ y }} src="/images/zurich.jpg" alt="Alpine village with a waterfall in Lauterbrunnen, Switzerland" className="absolute inset-0 -z-10 h-[130%] w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-sky-950/85 via-sky-900/30 to-sky-900/40" />
        <div className="mx-auto w-full max-w-7xl px-4 text-white sm:px-6 lg:px-8">
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold uppercase tracking-[0.2em] text-sky-200">
            About SkyVoyage
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE, duration: 0.8, delay: 0.1 }} className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">
            We believe nobody should have to leave family behind to travel.
          </motion.h1>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <SectionHeading eyebrow="Our story" title="It started with a dog who couldn't come along." />
            <Reveal delay={0.1}>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink-soft">
                <p>Booking a train or flight in India is easy, until you try to bring a pet. Rules are scattered, compartments are unclear, and families end up split across coaches, or leave their pets at home.</p>
                <p>SkyVoyage brings flights and trains into one booking flow and treats pets as real travellers: dedicated pet rows on flights, a pet coach on trains where your party always shares one cabin, and a health check before every trip.</p>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-8 grid grid-cols-3 gap-4">
                {[
                  [domestic, 'Indian cities'],
                  [abroad, 'Countries abroad'],
                  [2, 'Ways to travel'],
                ].map(([n, label]) => (
                  <div key={label} className="rounded-3xl bg-sky-50 p-5 text-center ring-1 ring-sky-100">
                    <p className="font-display text-3xl font-extrabold text-sky-600">{n}</p>
                    <p className="mt-1 text-xs font-semibold text-ink-soft">{label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
          <Reveal>
            <div className="relative">
              <img src="/images/pet-dog.jpg" alt="French bulldog in a yellow hoodie" className="h-[30rem] w-full rounded-[32px] object-cover shadow-float" loading="lazy" />
              <div className="absolute -bottom-6 -left-4 flex items-center gap-3 rounded-3xl bg-white p-4 shadow-float ring-1 ring-sky-100 sm:-left-8">
                <BrandMark className="h-12 w-12" />
                <span>
                  <span className="block font-display font-bold">Flights · Trains · Pets</span>
                  <span className="block text-sm text-ink-soft">One booking for everyone</span>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-sky-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading center eyebrow="What we stand for" title="Our promises" />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.08}>
                <div className="h-full rounded-[28px] bg-white p-7 shadow-soft ring-1 ring-sky-100">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-500 text-white shadow-soft">
                    <v.icon size={22} />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{v.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading center eyebrow="The team" title="Built by Creative Sparks" sub="B.Tech Data Science students who wanted travel to work for everyone, pets included." />
          <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-3">
            {TEAM.map((m, i) => (
              <Reveal key={m.name} delay={i * 0.08}>
                <div className="rounded-[28px] bg-gradient-to-b from-sky-50 to-white p-7 text-center ring-1 ring-sky-100">
                  <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 font-display text-2xl font-bold text-white shadow-soft">
                    {m.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{m.name}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{m.role}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 rounded-[36px] bg-gradient-to-br from-sky-500 to-sky-700 p-10 text-white shadow-float">
            <div>
              <h2 className="font-display text-3xl font-bold">Questions or feedback?</h2>
              <p className="mt-2 flex items-center gap-2 text-sky-50">
                <Mail size={17} /> hello@skyvoyage.example · we reply within a day
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to={searchUrl(defaultSearch())} className="group inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-bold text-sky-700">
                Plan a trip <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/#faq" className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-6 py-3.5 font-bold ring-1 ring-white/40">
                <HeartHandshake size={17} /> Read the FAQ
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  )
}
