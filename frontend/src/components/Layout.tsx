import { AnimatePresence, motion } from 'framer-motion'
import { BadgePercent, CheckCircle2, ChevronDown, House, Info, LayoutDashboard, LogOut, Menu, Plane, Ticket, TrainFront, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { addDays, cn, todayISO } from '../lib/format'
import { useAuth, useCurrentUser } from '../store/auth'
import { isCancelled, useBooking } from '../store/booking'
import { useToast } from '../store/toast'
import { Logo } from './ui'

const searchLink = (mode: 'flight' | 'train') => `/search?mode=${mode}&from=BLR&to=DEL&date=${addDays(todayISO(), 7)}&ad=1`

const LINKS = [
  { to: '/', label: 'Home', icon: House, match: (p: string) => p === '/' },
  { to: searchLink('flight'), label: 'Flights', icon: Plane, match: (p: string) => p.includes('mode=flight') },
  { to: searchLink('train'), label: 'Trains', icon: TrainFront, match: (p: string) => p.includes('mode=train') },
  { to: '/offers', label: 'Offers', icon: BadgePercent, match: (p: string) => p.startsWith('/offers') },
  { to: '/about', label: 'About', icon: Info, match: (p: string) => p.startsWith('/about') },
]

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

export function Navbar() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const logout = useAuth((s) => s.logout)
  const toast = useToast((s) => s.push)
  const trips = useBooking((s) => s.bookings.filter((b) => !isCancelled(b)).length)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const overHero = pathname === '/' || pathname === '/about'
  const solid = scrolled || !overHero || open
  const here = pathname + search

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
    setMenu(false)
  }, [here])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const signOut = async () => {
    await logout()
    toast('You have been signed out', 'info')
    navigate('/')
  }

  return (
    <header
      className={cn(
        'no-print fixed inset-x-0 top-0 z-50 transition-all duration-500',
        solid ? 'bg-white/85 shadow-[0_1px_0_rgb(14_165_233/0.12),0_8px_30px_-12px_rgb(3_105_161/0.15)] backdrop-blur-xl' : 'bg-gradient-to-b from-sky-950/40 to-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <Logo light={!solid} />
        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const active = l.match(here)
            return (
              <li key={l.label}>
                <Link
                  to={l.to}
                  className={cn(
                    'relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors',
                    active ? (solid ? 'text-sky-700' : 'text-white') : solid ? 'text-ink-soft hover:text-ink' : 'text-white/85 hover:text-white',
                  )}
                >
                  {active && (
                    <motion.span layoutId="nav-pill" className={cn('absolute inset-0 -z-10 rounded-full', solid ? 'bg-sky-100/80' : 'bg-white/20 backdrop-blur')} transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                  )}
                  <l.icon size={16} />
                  {l.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className={cn('flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-bold transition', solid ? 'bg-sky-50 text-ink ring-1 ring-sky-100 hover:bg-sky-100' : 'bg-white/20 text-white backdrop-blur hover:bg-white/30')}
                aria-expanded={menu}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 text-xs font-bold text-white">{initials(user.name)}</span>
                {user.name.split(' ')[0]}
                <ChevronDown size={15} className={cn('transition', menu && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {menu && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white p-2 shadow-float ring-1 ring-sky-100">
                    <div className="border-b border-sky-50 px-3 pb-3 pt-2">
                      <p className="font-bold text-ink">{user.name}</p>
                      <p className="truncate text-xs text-ink-soft">{user.email}</p>
                    </div>
                    <Link to="/trips" className="mt-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-sky-50">
                      <span className="flex items-center gap-2">
                        <Ticket size={16} className="text-sky-500" /> My trips
                      </span>
                      {trips > 0 && <span className="rounded-full bg-sky-500 px-2 text-xs font-bold text-white">{trips}</span>}
                    </Link>
                    {user.role === 'ADMIN' && (
                      <Link to="/admin" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-sky-50">
                        <LayoutDashboard size={16} className="text-sky-500" /> Admin dashboard
                      </Link>
                    )}
                    <button onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-50">
                      <LogOut size={16} /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link to="/login" className={cn('rounded-full px-4 py-2.5 text-sm font-bold transition', solid ? 'text-ink hover:bg-sky-50' : 'text-white hover:bg-white/15')}>
                Log in
              </Link>
              <Link to="/register" className={cn('rounded-full px-5 py-2.5 text-sm font-bold shadow-soft transition', solid ? 'bg-ink text-white hover:bg-sky-700' : 'bg-white text-sky-700 hover:bg-sky-50')}>
                Sign up
              </Link>
            </>
          )}
        </div>

        <button className={cn('grid h-10 w-10 place-items-center rounded-xl lg:hidden', solid ? 'text-ink' : 'text-white')} onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-sky-100 bg-white px-4 lg:hidden">
            <ul className="py-2">
              {[...LINKS, { to: '/trips', label: 'My trips', icon: Ticket, match: () => false }].map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="flex items-center gap-3 py-3 font-semibold text-ink">
                    <l.icon size={18} className="text-sky-500" /> {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 border-t border-sky-50 py-4">
              {user ? (
                <button onClick={signOut} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-50 py-3 font-bold text-rose-500">
                  <LogOut size={16} /> Sign out {user.name.split(' ')[0]}
                </button>
              ) : (
                <>
                  <Link to="/login" className="flex-1 rounded-2xl bg-sky-50 py-3 text-center font-bold text-sky-700">
                    Log in
                  </Link>
                  <Link to="/register" className="flex-1 rounded-2xl bg-sky-500 py-3 text-center font-bold text-white">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="no-print relative overflow-hidden bg-ink text-sky-100">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <Logo light tagline />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-sky-100/70">Flights and trains in one place, with real space for the pets who travel with you.</p>
        </div>
        {[
          { title: 'Book', items: [['Flights', searchLink('flight')], ['Trains', searchLink('train')], ['Special offers', '/offers'], ['Pet travel', '/#pets']] },
          { title: 'Manage', items: [['My trips', '/trips'], ['PNR status', '/#services'], ['Log in', '/login'], ['Create account', '/register']] },
          { title: 'Company', items: [['About us', '/about'], ['Reviews', '/#reviews'], ['FAQ', '/#faq'], ['Pet policy', '/#pets']] },
        ].map((col) => (
          <div key={col.title}>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white">{col.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.items.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="text-sky-100/70 transition hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs text-sky-100/50">© {new Date().getFullYear()} SkyVoyage · Smart travel booking with pet support</div>
    </footer>
  )
}

/** Scrolls to the top on page change, or to the #section when the URL has a hash. */
export function ScrollManager() {
  const { pathname, hash, search } = useLocation()
  useEffect(() => {
    if (hash) {
      const id = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 80)
      return () => clearTimeout(id)
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash, search])
  return null
}

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const icons = { info: Info, success: CheckCircle2, warn: TriangleAlert }
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 top-20 z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.tone]
          return (
            <motion.button
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-sm font-medium text-ink shadow-float ring-1 ring-sky-100"
            >
              <Icon size={18} className={cn('shrink-0', t.tone === 'success' ? 'text-emerald-500' : t.tone === 'warn' ? 'text-paw' : 'text-sky-500')} />
              {t.text}
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
