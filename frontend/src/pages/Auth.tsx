import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandMark, Wordmark } from '../components/Brand'
import { EASE } from '../components/ui'
import { cn } from '../lib/format'
import { useAuth, useCurrentUser } from '../store/auth'
import { useToast } from '../store/toast'

const input = 'w-full rounded-2xl bg-sky-50/70 py-3.5 pl-11 pr-4 text-sm font-medium text-ink outline-none ring-1 ring-sky-100 transition placeholder:text-ink-soft/50 focus:bg-white focus:ring-2 focus:ring-sky-400'

function Field({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sky-400" />
      {children}
    </div>
  )
}

export default function Auth() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const { login, register } = useAuth()
  const toast = useToast((s) => s.push)
  const mode = pathname === '/register' ? 'register' : 'login'
  const next = params.get('next') ?? '/'

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value })

  if (user && !busy) return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'register') {
      if (form.name.trim().length < 2) return setError('Please enter your full name.')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Please enter a valid email address.')
      if (!/^[6-9]\d{9}$/.test(form.phone)) return setError('Please enter a 10-digit mobile number.')
      if (form.password.length < 8 || !/\d/.test(form.password) || !/[a-z]/i.test(form.password)) return setError('Use at least 8 characters with letters and a number.')
      if (form.password !== form.confirm) return setError("Passwords don't match.")
    }
    setBusy(true)
    const err = mode === 'register' ? await register(form) : await login(form.email, form.password)
    if (err) {
      setBusy(false)
      return setError(err)
    }
    toast(mode === 'register' ? `Welcome aboard, ${form.name.split(' ')[0]}!` : 'Signed in. Welcome back!', 'success')
    navigate(next, { replace: true })
  }

  const strength = [form.password.length >= 8, /\d/.test(form.password), /[A-Z]/.test(form.password), /[^\w]/.test(form.password)].filter(Boolean).length

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <motion.img initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 8, ease: 'linear' }} src={mode === 'login' ? '/images/hero/swiss-alps.jpg' : '/images/hero/maldives.jpg'} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-sky-950/80 via-sky-900/20 to-sky-900/30" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <BrandMark className="h-14 w-14" />
          <h2 className="mt-6 max-w-md font-display text-4xl font-bold leading-tight">{mode === 'login' ? 'Welcome back, traveller.' : 'Every trip starts with a single tap.'}</h2>
          <p className="mt-3 max-w-md text-sky-50/90">Your tickets, pet passes and PNR status, all in one account.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 pb-16 pt-28 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE, duration: 0.6 }} className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark className="h-11 w-11" />
            <Wordmark />
          </Link>
          <div className="flex rounded-2xl bg-sky-50 p-1 ring-1 ring-sky-100">
            {(['login', 'register'] as const).map((m) => (
              <Link key={m} to={`/${m}${params.toString() ? `?${params}` : ''}`} replace className={cn('relative flex-1 rounded-xl py-2.5 text-center text-sm font-bold transition', mode === m ? 'text-sky-700' : 'text-ink-soft')}>
                {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-xl bg-white shadow-soft" />}
                <span className="relative">{m === 'login' ? 'Log in' : 'Sign up'}</span>
              </Link>
            ))}
          </div>

          <h1 className="mt-8 font-display text-3xl font-bold">{mode === 'login' ? 'Log in to SkyVoyage' : 'Create your account'}</h1>
          <p className="mt-2 text-ink-soft">{next.startsWith('/book') ? 'Sign in to finish your booking. Your seats are still held.' : mode === 'login' ? 'Good to see you again.' : 'It takes less than a minute.'}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <AnimatePresence initial={false}>
              {mode === 'register' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                  <Field icon={User}>
                    <input className={input} placeholder="Full name" value={form.name} onChange={set('name')} autoComplete="name" />
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
            <Field icon={Mail}>
              <input className={input} type="email" placeholder="Email address" value={form.email} onChange={set('email')} autoComplete="email" />
            </Field>
            {mode === 'register' && (
              <Field icon={Phone}>
                <input className={input} inputMode="numeric" placeholder="Mobile number" value={form.phone} onChange={set('phone')} autoComplete="tel-national" />
              </Field>
            )}
            <Field icon={Lock}>
              <input className={cn(input, 'pr-12')} type={show ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-soft hover:bg-sky-100">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </Field>
            {mode === 'register' && (
              <>
                <div className="flex gap-1.5 px-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={cn('h-1.5 flex-1 rounded-full transition', i < strength ? (strength < 2 ? 'bg-rose-400' : strength < 4 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-sky-100')} />
                  ))}
                </div>
                <Field icon={Lock}>
                  <input className={input} type={show ? 'text' : 'password'} placeholder="Confirm password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
                </Field>
              </>
            )}

            {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</p>}

            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 py-4 font-bold text-white shadow-[0_14px_30px_-10px_rgb(2_132_199/0.8)] transition hover:-translate-y-0.5 disabled:opacity-60">
              {busy ? <Loader2 size={18} className="animate-spin" /> : null}
              {mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={17} />
            </button>
          </form>

          <p className="mt-6 flex items-start gap-2 text-xs text-ink-soft">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-500" />
            Demo accounts are stored only in this browser, and passwords are saved as salted hashes, never in plain text.
          </p>
        </motion.div>
      </div>
    </main>
  )
}
