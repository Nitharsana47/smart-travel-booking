import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, CalendarDays, ChevronDown, Minus, PawPrint, Plane, Plus, Search, TrainFront, Users, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cityByCode, citiesFor, FARE_TYPES, PET_SIZES, QUOTAS, TRAIN_CLASSES, type FareType, type Mode, type PetSize, type Quota } from '../lib/data'
import { addDays, cn, fmtDate, todayISO } from '../lib/format'
import { defaultSearch, searchUrl, travellerSummary, type SearchValues } from '../lib/search'

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

const fieldClass = 'group relative w-full rounded-2xl px-4 py-3 text-left transition hover:bg-sky-50/80 focus-visible:bg-sky-50 focus-visible:outline-none'
const labelClass = 'flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft'
const popClass = 'absolute top-full z-40 mt-2 rounded-2xl bg-white p-2 shadow-float ring-1 ring-sky-100'
const pop = { initial: { opacity: 0, y: 8, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 6, scale: 0.98 }, transition: { duration: 0.18 } }

function CityPicker({ label, value, exclude, mode, onChange }: { label: string; value: string; exclude: string; mode: Mode; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useClickAway(open, () => setOpen(false))
  const city = cityByCode(value)!
  const list = citiesFor(mode).filter((c) => c.code !== exclude && `${c.name} ${c.code} ${c.station} ${c.state}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div ref={ref} className="relative">
      <button type="button" className={fieldClass} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className={labelClass}>{label}</span>
        <span className="mt-0.5 block font-display text-2xl font-bold text-ink">{mode === 'flight' ? city.code : city.station}</span>
        <span className="block truncate text-sm text-ink-soft">{city.name}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...pop} className={cn(popClass, 'left-0 w-[min(21rem,85vw)]')}>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search city, airport or station"
              className="mb-1 w-full rounded-xl bg-sky-50 px-3 py-2.5 text-sm outline-none ring-sky-300 placeholder:text-ink-soft/60 focus:ring-2"
            />
            <ul role="listbox" className="max-h-72 overflow-auto">
              {list.map((c, i) => (
                <li key={c.code}>
                  {c.intl && !list[i - 1]?.intl && <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-ink-soft">International</p>}
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.code)
                      setOpen(false)
                      setQ('')
                    }}
                    className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-sky-50', c.code === value && 'bg-sky-50')}
                  >
                    <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg bg-sky-100 font-mono text-xs font-bold text-sky-700">{mode === 'flight' ? c.code : c.station}</span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{c.name}</span>
                      <span className="block text-xs text-ink-soft">{c.state}</span>
                    </span>
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-soft">No matching city</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DateField({ label, value, min, onChange, onClear, placeholder }: { label: string; value: string | null; min: string; onChange: (d: string) => void; onClear?: () => void; placeholder?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null)
  const openPicker = () => (ref.current?.showPicker ? ref.current.showPicker() : ref.current?.focus())
  return (
    <div className="relative">
      <button type="button" className={fieldClass} onClick={openPicker}>
        <span className={labelClass}>
          <CalendarDays size={13} /> {label}
        </span>
        {value ? (
          <>
            <span className="mt-0.5 block font-display text-2xl font-bold text-ink">{fmtDate(value, { day: 'numeric', month: 'short' })}</span>
            <span className="block text-sm text-ink-soft">{fmtDate(value, { weekday: 'long' })}</span>
          </>
        ) : (
          placeholder
        )}
      </button>
      {value && onClear && (
        <button type="button" onClick={onClear} aria-label="Remove return date" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-sky-100">
          <X size={14} />
        </button>
      )}
      <input
        ref={ref}
        type="date"
        min={min}
        value={value ?? min}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="pointer-events-none absolute bottom-0 left-4 h-0 w-0 opacity-0"
        tabIndex={-1}
        aria-label={label}
      />
    </div>
  )
}

function Counter({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-2 py-2.5">
      <div>
        <p className="font-semibold text-ink">{label}</p>
        <p className="text-xs text-ink-soft">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-8 w-8 place-items-center rounded-full ring-1 ring-sky-200 transition hover:bg-sky-50 disabled:opacity-30">
          <Minus size={14} />
        </button>
        <span className="w-5 text-center font-display text-lg font-bold">{value}</span>
        <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-8 w-8 place-items-center rounded-full ring-1 ring-sky-200 transition hover:bg-sky-50 disabled:opacity-30">
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

function TravellersPicker({ v, set }: { v: SearchValues; set: (p: Partial<SearchValues>) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useClickAway(open, () => setOpen(false))
  const seated = v.adults + v.children
  const classes = v.mode === 'flight' ? { '': 'Any class', ECO: 'Economy', BUS: 'Business' } : { '': 'All classes', ...Object.fromEntries(Object.entries(TRAIN_CLASSES).filter(([k]) => k !== 'PT')) }

  return (
    <div ref={ref} className="relative">
      <button type="button" className={fieldClass} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={labelClass}>
          <Users size={13} /> Travellers & class
        </span>
        <span className="mt-0.5 flex items-center gap-1 font-display text-2xl font-bold text-ink">
          {seated + v.infants}
          <span className="text-base font-semibold text-ink-soft">{seated + v.infants === 1 ? 'traveller' : 'travellers'}</span>
          <ChevronDown size={16} className={cn('ml-auto text-ink-soft transition', open && 'rotate-180')} />
        </span>
        <span className="block truncate text-sm text-ink-soft">{(classes as Record<string, string>)[v.cls] ?? 'Any class'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...pop} className={cn(popClass, 'right-0 w-[min(20rem,88vw)] p-3')}>
            <Counter label="Adults" hint="12 years and above" value={v.adults} min={1} max={9 - v.children} onChange={(adults) => set({ adults, infants: Math.min(v.infants, adults) })} />
            <Counter label="Children" hint="2 – 11 years" value={v.children} min={0} max={9 - v.adults} onChange={(children) => set({ children })} />
            <Counter label="Infants" hint="Under 2 · on an adult's lap" value={v.infants} min={0} max={v.adults} onChange={(infants) => set({ infants })} />
            <p className="mt-2 border-t border-sky-50 px-2 pt-3 text-[11px] font-bold uppercase tracking-widest text-ink-soft">{v.mode === 'flight' ? 'Cabin class' : 'Class'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 px-1">
              {Object.entries(classes).map(([code, name]) => (
                <button key={code} type="button" onClick={() => set({ cls: code })} className={cn('rounded-xl px-3 py-1.5 text-xs font-bold ring-1 transition', v.cls === code ? 'bg-sky-500 text-white ring-sky-500' : 'text-ink-soft ring-sky-100 hover:bg-sky-50')}>
                  {code && v.mode === 'train' ? `${code} · ${name}` : name}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-xl bg-sky-500 py-2.5 text-sm font-bold text-white">
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Chip({ active, onClick, children, tone = 'sky' }: { active: boolean; onClick: () => void; children: ReactNode; tone?: 'sky' | 'amber' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition',
        active ? (tone === 'sky' ? 'bg-sky-500 text-white ring-sky-500' : 'bg-paw text-white ring-paw') : tone === 'sky' ? 'bg-white text-ink-soft ring-sky-100 hover:bg-sky-50' : 'bg-white text-amber-800 ring-amber-200 hover:bg-paw-soft',
      )}
    >
      {children}
    </button>
  )
}

export function SearchWidget({ initial, className }: { initial?: SearchValues; className?: string }) {
  const navigate = useNavigate()
  const [v, setV] = useState<SearchValues>(initial ?? defaultSearch())
  const [spin, setSpin] = useState(0)
  const set = (patch: Partial<SearchValues>) => setV((s) => ({ ...s, ...patch }))

  const switchMode = (mode: Mode) => {
    const fix = (code: string, fallback: string) => (mode === 'train' && cityByCode(code)?.intl ? fallback : code)
    set({ mode, cls: '', from: fix(v.from, 'BLR'), to: fix(v.to, v.from === 'DEL' ? 'BOM' : 'DEL') })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        navigate(searchUrl(v))
      }}
      className={cn('relative rounded-[28px] bg-white/90 p-3 shadow-float ring-1 ring-white/70 backdrop-blur-xl sm:p-4', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex rounded-2xl bg-sky-50 p-1 ring-1 ring-sky-100">
            {(['flight', 'train'] as const).map((m) => (
              <button key={m} type="button" onClick={() => switchMode(m)} className={cn('relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors', v.mode === m ? 'text-white' : 'text-ink-soft hover:text-ink')}>
                {v.mode === m && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 shadow-soft" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative flex items-center gap-2">
                  {m === 'flight' ? <Plane size={16} /> : <TrainFront size={16} />}
                  {m === 'flight' ? 'Flights' : 'Trains'}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-1" role="radiogroup" aria-label="Trip type">
            {([
              ['one', 'One way'],
              ['round', 'Round trip'],
            ] as const).map(([t, label]) => (
              <label key={t} className={cn('flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition', v.trip === t ? 'text-sky-700' : 'text-ink-soft hover:text-ink')}>
                <input type="radio" name="trip" checked={v.trip === t} onChange={() => set({ trip: t, ret: v.ret > v.date ? v.ret : addDays(v.date, 4) })} className="h-4 w-4 accent-sky-500" />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={!!v.pet}
            onClick={() => set({ pet: v.pet ? null : 'small' })}
            className={cn('flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold ring-1 transition', v.pet ? 'bg-paw-soft text-amber-800 ring-amber-200' : 'text-ink-soft ring-sky-100 hover:bg-sky-50')}
          >
            <PawPrint size={16} className={v.pet ? 'text-paw' : ''} />
            With a pet
            <span className={cn('relative h-5 w-9 rounded-full transition', v.pet ? 'bg-paw' : 'bg-slate-200')}>
              <motion.span layout className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow', v.pet ? 'right-0.5' : 'left-0.5')} />
            </span>
          </button>
          <AnimatePresence>
            {v.pet && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex gap-1">
                {(Object.keys(PET_SIZES) as PetSize[]).map((s) => (
                  <Chip key={s} tone="amber" active={v.pet === s} onClick={() => set({ pet: s })}>
                    {PET_SIZES[s].label} <span className="font-medium opacity-75">· {PET_SIZES[s].weight}</span>
                  </Chip>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid gap-1 rounded-3xl bg-white ring-1 ring-sky-100 lg:grid-cols-[1fr_auto_1fr_0.9fr_0.9fr_1.1fr_auto] lg:items-center lg:p-1.5">
        <CityPicker label="From" value={v.from} exclude={v.to} mode={v.mode} onChange={(from) => set({ from })} />
        <div className="relative z-10 -my-4 flex justify-center lg:my-0">
          <motion.button
            type="button"
            aria-label="Swap origin and destination"
            animate={{ rotate: spin }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            onClick={() => {
              setSpin((s) => s + 180)
              set({ from: v.to, to: v.from })
            }}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-sky-600 shadow-soft ring-1 ring-sky-100 transition hover:bg-sky-50"
          >
            <ArrowLeftRight size={17} />
          </motion.button>
        </div>
        <CityPicker label="To" value={v.to} exclude={v.from} mode={v.mode} onChange={(to) => set({ to })} />

        <div className="border-t border-sky-50 lg:border-l lg:border-t-0">
          <DateField label="Departure" value={v.date} min={todayISO()} onChange={(date) => set({ date, ret: v.ret < date ? addDays(date, 2) : v.ret })} />
        </div>
        <div className="border-t border-sky-50 lg:border-l lg:border-t-0">
          <DateField
            label="Return"
            value={v.trip === 'round' ? v.ret : null}
            min={v.date}
            onChange={(ret) => set({ ret, trip: 'round' })}
            onClear={() => set({ trip: 'one' })}
            placeholder={
              <span className="mt-1 block text-sm font-semibold leading-snug text-sky-600">
                + Add return
                <span className="block text-xs font-medium text-ink-soft">Save more on round trips</span>
              </span>
            }
          />
        </div>
        <div className="border-t border-sky-50 lg:border-l lg:border-t-0">
          <TravellersPicker v={v} set={set} />
        </div>

        <div className="p-2 lg:p-0">
          <button
            type="submit"
            className="group flex h-full w-full items-center justify-center gap-2 rounded-[22px] bg-gradient-to-br from-sky-500 to-sky-600 px-7 py-4 font-bold text-white shadow-[0_14px_30px_-10px_rgb(2_132_199/0.8)] transition hover:-translate-y-0.5 active:scale-[0.98] lg:min-h-[96px]"
          >
            <Search size={20} className="transition-transform group-hover:scale-110" />
            <span className="lg:hidden xl:inline">Search</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1 pt-3">
        <span className="mr-1 text-xs font-bold uppercase tracking-widest text-ink-soft">{v.mode === 'flight' ? 'Special fares' : 'Quota'}</span>
        {v.mode === 'flight'
          ? (Object.keys(FARE_TYPES) as FareType[]).map((f) => (
              <Chip key={f} active={v.fare === f} onClick={() => set({ fare: f })}>
                {FARE_TYPES[f].label}
              </Chip>
            ))
          : (Object.keys(QUOTAS) as Quota[]).map((q) => (
              <Chip key={q} active={v.quota === q} onClick={() => set({ quota: q })}>
                {QUOTAS[q].label}
              </Chip>
            ))}
        <span className="text-xs text-ink-soft">{v.mode === 'flight' ? FARE_TYPES[v.fare].note : QUOTAS[v.quota].note}</span>
        <span className="ml-auto hidden text-xs font-semibold text-ink-soft sm:inline">{travellerSummary(v)}</span>
      </div>
    </form>
  )
}
