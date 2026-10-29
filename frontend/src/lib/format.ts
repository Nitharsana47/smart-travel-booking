export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

export const fmtDuration = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`

/** Minutes after midnight → "06:45". Values past 24h wrap to the next day. */
export const fmtTime = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', opts)

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')
