import { cityByCode, FARE_TYPES, PET_SIZES, QUOTAS, type FareType, type Mode, type PetSize, type Quota, type TripType } from './data'
import { addDays, todayISO } from './format'

export interface SearchValues {
  mode: Mode
  trip: TripType
  from: string
  to: string
  date: string
  ret: string
  adults: number
  children: number
  infants: number
  cls: string // preferred class, '' = any
  fare: FareType
  quota: Quota
  pet: PetSize | null
}

export const defaultSearch = (patch: Partial<SearchValues> = {}): SearchValues => {
  const date = addDays(todayISO(), 7)
  return { mode: 'flight', trip: 'one', from: 'BLR', to: 'DEL', date, ret: addDays(date, 4), adults: 1, children: 0, infants: 0, cls: '', fare: 'regular', quota: 'GN', pet: null, ...patch }
}

export function searchUrl(v: SearchValues) {
  const p = new URLSearchParams({ mode: v.mode, from: v.from, to: v.to, date: v.date, ad: String(v.adults) })
  if (v.trip === 'round') {
    p.set('trip', 'round')
    p.set('ret', v.ret)
  }
  if (v.children) p.set('ch', String(v.children))
  if (v.infants) p.set('in', String(v.infants))
  if (v.cls) p.set('cls', v.cls)
  if (v.mode === 'flight' && v.fare !== 'regular') p.set('fare', v.fare)
  if (v.mode === 'train' && v.quota !== 'GN') p.set('quota', v.quota)
  if (v.pet) p.set('pet', v.pet)
  return `/search?${p}`
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Reads search values from the URL, falling back to sensible defaults for anything missing or invalid. */
export function parseSearch(p: URLSearchParams): SearchValues {
  const d = defaultSearch()
  const mode: Mode = p.get('mode') === 'train' ? 'train' : 'flight'
  const valid = (code: string | null) => {
    const c = code && cityByCode(code)
    return c && (mode === 'flight' || !c.intl) ? c.code : null
  }
  const date = (p.get('date') ?? '') >= todayISO() ? p.get('date')! : d.date
  const ret = (p.get('ret') ?? '') >= date ? p.get('ret')! : addDays(date, 4)
  const adults = clamp(Number(p.get('ad') ?? p.get('pax')) || 1, 1, 9)
  const children = clamp(Number(p.get('ch')) || 0, 0, 9 - adults)
  return {
    mode,
    trip: p.get('trip') === 'round' ? 'round' : 'one',
    from: valid(p.get('from')) ?? 'BLR',
    to: valid(p.get('to')) ?? 'DEL',
    date,
    ret,
    adults,
    children,
    infants: clamp(Number(p.get('in')) || 0, 0, adults),
    cls: p.get('cls') ?? '',
    fare: (p.get('fare') as FareType) in FARE_TYPES ? (p.get('fare') as FareType) : 'regular',
    quota: (p.get('quota') as Quota) in QUOTAS ? (p.get('quota') as Quota) : 'GN',
    pet: (p.get('pet') as PetSize) in PET_SIZES ? (p.get('pet') as PetSize) : null,
  }
}

export const travellerSummary = (v: Pick<SearchValues, 'adults' | 'children' | 'infants'>) =>
  [
    `${v.adults} ${v.adults === 1 ? 'adult' : 'adults'}`,
    v.children && `${v.children} ${v.children === 1 ? 'child' : 'children'}`,
    v.infants && `${v.infants} ${v.infants === 1 ? 'infant' : 'infants'}`,
  ]
    .filter(Boolean)
    .join(', ')
