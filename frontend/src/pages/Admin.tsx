import { motion } from 'framer-motion'
import { CheckCircle2, CircleSlash, Clock3, IndianRupee, PawPrint, RefreshCw, Ticket, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Card, EASE, PageShell } from '../components/ui'
import { api } from '../lib/api'
import { inr } from '../lib/format'

interface Stats {
  users: number
  bookings: number
  legsByStatus: Partial<Record<'CONFIRMED' | 'WAITLIST' | 'CANCELLED', number>>
  revenue: number
  refunded: number
  petsBySize: Partial<Record<'small' | 'medium' | 'large', number>>
  topRoutes: { route: string; count: number }[]
}

function Tile({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: string; note?: string }) {
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <Icon size={16} className="text-sky-500" /> {label}
      </p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-soft">{note}</p>}
    </Card>
  )
}

export default function Admin() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    api<Stats>('/admin/stats')
      .then((s) => {
        setStats(s)
        setError('')
      })
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const max = Math.max(1, ...(stats?.topRoutes.map((r) => r.count) ?? [1]))
  const pets = stats ? Object.values(stats.petsBySize).reduce((a, b) => a + (b ?? 0), 0) : 0

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE }}>
            <h1 className="font-display text-4xl font-bold">Admin dashboard</h1>
            <p className="mt-2 text-ink-soft">Live numbers from the database. Visible to admins only.</p>
          </motion.div>
          <button onClick={load} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-sky-700 shadow-soft ring-1 ring-sky-100 hover:bg-sky-50">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {error && <p className="mt-8 rounded-2xl bg-rose-50 p-4 font-semibold text-rose-600">{error}</p>}
        {!stats && !error && <div className="mt-8 h-64 animate-pulse rounded-3xl bg-white ring-1 ring-sky-100" />}

        {stats && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Tile icon={IndianRupee} label="Revenue" value={inr(stats.revenue)} note={`${inr(stats.refunded)} in cancelled bookings`} />
              <Tile icon={Ticket} label="Bookings" value={String(stats.bookings)} />
              <Tile icon={Users} label="Registered users" value={String(stats.users)} />
              <Tile icon={PawPrint} label="Trips with pets" value={String(pets)} note={(['small', 'medium', 'large'] as const).map((s) => `${stats.petsBySize[s] ?? 0} ${s}`).join(' · ')} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
              <Card>
                <h2 className="font-display text-lg font-bold">Journeys by status</h2>
                <ul className="mt-4 space-y-3">
                  {([
                    ['CONFIRMED', 'Confirmed', CheckCircle2, 'text-emerald-600'],
                    ['WAITLIST', 'Waitlisted', Clock3, 'text-amber-600'],
                    ['CANCELLED', 'Cancelled', CircleSlash, 'text-rose-500'],
                  ] as const).map(([key, label, Icon, tone]) => (
                    <li key={key} className="flex items-center justify-between rounded-2xl bg-sky-50/60 px-4 py-3">
                      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Icon size={17} className={tone} /> {label}
                      </span>
                      <span className="font-display text-xl font-bold tabular-nums text-ink">{stats.legsByStatus[key] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <h2 className="font-display text-lg font-bold">Top routes</h2>
                <p className="text-sm text-ink-soft">Journeys sold, excluding cancellations</p>
                {stats.topRoutes.length === 0 ? (
                  <p className="mt-6 text-sm text-ink-soft">No bookings yet.</p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {stats.topRoutes.map((r) => {
                      const [mode, path] = r.route.split(':')
                      return (
                        <li key={r.route} className="group">
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="font-semibold text-ink">
                              {path} <span className="font-normal text-ink-soft">· {mode}</span>
                            </span>
                            <span className="font-semibold tabular-nums text-ink">{r.count}</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-sky-50" title={`${path} (${mode}): ${r.count} journeys`}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(r.count / max) * 100}%` }} transition={{ duration: 0.8, ease: EASE }} className="h-full rounded-full bg-sky-500 transition-colors group-hover:bg-sky-600" />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
