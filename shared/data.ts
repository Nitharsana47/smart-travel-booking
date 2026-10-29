// Mock inventory for the frontend. Everything is generated from a seeded random
// number generator, so the same search always returns the same trips and seats.
// The backend will replace this module with real API calls.

export type Mode = 'flight' | 'train'
export type PetSize = 'small' | 'medium' | 'large'

export interface City {
  code: string // airport code
  station: string // railway station code ('' for international cities)
  name: string
  state: string // state, or country for international cities
  lat: number
  lon: number
  intl?: boolean
}

export interface FareClass {
  code: string
  name: string
  price: number
  available: number
  total: number
  waitlist: number // current waitlist length when available is 0 (trains only)
  isPet?: boolean
}

export interface Trip {
  id: string
  mode: Mode
  operator: string
  operatorCode: string
  color: string
  number: string
  from: City
  to: City
  date: string
  depMin: number
  durMin: number
  stops: number
  km: number
  classes: FareClass[]
  petFriendly: boolean
  tatkalLeft: number
  amenities: string[]
}

export const CITIES: City[] = [
  { code: 'DEL', station: 'NDLS', name: 'New Delhi', state: 'Delhi', lat: 28.61, lon: 77.21 },
  { code: 'BOM', station: 'CSMT', name: 'Mumbai', state: 'Maharashtra', lat: 19.08, lon: 72.88 },
  { code: 'BLR', station: 'SBC', name: 'Bengaluru', state: 'Karnataka', lat: 12.97, lon: 77.59 },
  { code: 'MAA', station: 'MAS', name: 'Chennai', state: 'Tamil Nadu', lat: 13.08, lon: 80.27 },
  { code: 'CCU', station: 'HWH', name: 'Kolkata', state: 'West Bengal', lat: 22.57, lon: 88.36 },
  { code: 'HYD', station: 'SC', name: 'Hyderabad', state: 'Telangana', lat: 17.39, lon: 78.49 },
  { code: 'GOI', station: 'MAO', name: 'Goa', state: 'Goa', lat: 15.3, lon: 74.12 },
  { code: 'JAI', station: 'JP', name: 'Jaipur', state: 'Rajasthan', lat: 26.91, lon: 75.79 },
  { code: 'AGR', station: 'AGC', name: 'Agra', state: 'Uttar Pradesh', lat: 27.18, lon: 78.01 },
  { code: 'COK', station: 'ERS', name: 'Kochi', state: 'Kerala', lat: 9.93, lon: 76.27 },
  { code: 'PNQ', station: 'PUNE', name: 'Pune', state: 'Maharashtra', lat: 18.52, lon: 73.86 },
  { code: 'AMD', station: 'ADI', name: 'Ahmedabad', state: 'Gujarat', lat: 23.02, lon: 72.57 },
  // International destinations are flight-only.
  { code: 'DXB', station: '', name: 'Dubai', state: 'United Arab Emirates', lat: 25.25, lon: 55.36, intl: true },
  { code: 'SIN', station: '', name: 'Singapore', state: 'Singapore', lat: 1.36, lon: 103.99, intl: true },
  { code: 'MLE', station: '', name: 'Malé', state: 'Maldives', lat: 4.19, lon: 73.53, intl: true },
  { code: 'DPS', station: '', name: 'Bali (Denpasar)', state: 'Indonesia', lat: -8.75, lon: 115.17, intl: true },
  { code: 'ZRH', station: '', name: 'Zurich', state: 'Switzerland', lat: 47.46, lon: 8.55, intl: true },
  { code: 'JTR', station: '', name: 'Santorini', state: 'Greece', lat: 36.4, lon: 25.48, intl: true },
]

/** "2026-11-20" + n days, computed in UTC so server and browser agree. */
export function addDaysISO(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const cityByCode = (code: string) => CITIES.find((c) => c.code === code)
export const citiesFor = (mode: Mode) => CITIES.filter((c) => mode === 'flight' || !c.intl)

export type TripType = 'one' | 'round'
export type FareType = 'regular' | 'student' | 'senior' | 'armed'
export type Quota = 'GN' | 'TQ' | 'LD' | 'SS'

/** Flight special fares: a discount on the base fare, with an ID check at the airport. */
export const FARE_TYPES: Record<FareType, { label: string; discount: number; note: string }> = {
  regular: { label: 'Regular', discount: 0, note: 'Standard fares' },
  student: { label: 'Student', discount: 0.1, note: '10% off · student ID at check-in' },
  senior: { label: 'Senior citizen', discount: 0.08, note: '8% off · all travellers 60+' },
  armed: { label: 'Armed forces', discount: 0.12, note: '12% off · service ID at check-in' },
}

/** Train booking quotas, as on Indian Railways. */
export const QUOTAS: Record<Quota, { label: string; note: string }> = {
  GN: { label: 'General', note: 'Open to everyone' },
  TQ: { label: 'Tatkal', note: '+30% · last-minute quota' },
  LD: { label: 'Ladies', note: 'Women travellers only' },
  SS: { label: 'Senior citizen', note: 'Travellers aged 60+' },
}

const AIRLINES = [
  { name: 'SkyVoyage Air', code: 'SV', color: '#0ea5e9' },
  { name: 'Monsoon Air', code: 'MN', color: '#14b8a6' },
  { name: 'Saffron Wings', code: 'SW', color: '#f97316' },
  { name: 'BlueJay Airways', code: 'BJ', color: '#6366f1' },
]

const TRAINS = [
  { name: 'Sapphire Express', color: '#0284c7' },
  { name: 'Konkan Breeze', color: '#0d9488' },
  { name: 'Garuda Superfast', color: '#ea580c' },
  { name: 'Deccan Star Mail', color: '#7c3aed' },
  { name: 'Silver Arrow Express', color: '#475569' },
]

export const TRAIN_CLASSES: Record<string, string> = {
  SL: 'Sleeper',
  '3A': 'AC 3 Tier',
  '2A': 'AC 2 Tier',
  '1A': 'AC First',
  PT: 'Pet Coach',
}

/** FNV-1a string hash, used to seed the generator. */
export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32: small, fast, deterministic PRNG returning numbers in [0, 1). */
export function rng(seed: string) {
  let a = hash(seed)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function distanceKm(a: City, b: City) {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)))
}

const fare = (n: number) => Math.round(n / 10) * 10 - 1
const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)]

export function generateTrips(mode: Mode, fromCode: string, toCode: string, date: string): Trip[] {
  const from = cityByCode(fromCode)
  const to = cityByCode(toCode)
  if (!from || !to || from === to) return []
  if (mode === 'train' && (from.intl || to.intl)) return []

  const km = distanceKm(from, to)
  const r = rng(`${mode}|${fromCode}|${toCode}|${date}`)
  const trips: Omit<Trip, 'id'>[] = []

  if (mode === 'flight') {
    for (let i = 0; i < 7; i++) {
      const airline = pick(r, AIRLINES)
      const depMin = Math.round((330 + r() * 1050) / 5) * 5
      const stops = km > 1300 && r() < 0.3 ? 1 : 0
      const durMin = Math.round((40 + km / 12.5 + stops * 75 + r() * 20) / 5) * 5
      const eco = fare(2200 + km * 3.1 + r() * 1500 - (depMin < 420 ? 500 : 0))
      const ecoLeft = r() < 0.08 ? 0 : 2 + Math.floor(r() * 45)
      trips.push({
        mode,
        operator: airline.name,
        operatorCode: airline.code,
        color: airline.color,
        number: `${airline.code} ${100 + Math.floor(r() * 899)}`,
        from,
        to,
        date,
        depMin,
        durMin,
        stops,
        km,
        petFriendly: r() < 0.75,
        tatkalLeft: 0,
        amenities: ['Meal', 'USB power', 'Wi-Fi'].filter(() => r() < 0.6),
        classes: [
          { code: 'ECO', name: 'Economy', price: eco, available: ecoLeft, total: 156, waitlist: 0 },
          { code: 'BUS', name: 'Business', price: fare(eco * 3.1), available: Math.floor(r() * 11), total: 12, waitlist: 0 },
        ],
      })
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const train = TRAINS[i % TRAINS.length]
      const depMin = Math.round((240 + r() * 1140) / 5) * 5
      const speed = 52 + r() * 28
      const durMin = Math.max(120, Math.round(((km * 1.22) / speed) * 12) * 5)
      const petFriendly = r() < 0.7
      const avail = (total: number) => (r() < 0.22 ? 0 : 1 + Math.floor(r() * Math.min(total, 90)))
      const cls = (code: string, price: number, total: number): FareClass => {
        const available = avail(total)
        return {
          code,
          name: TRAIN_CLASSES[code],
          price: fare(price),
          available,
          total,
          waitlist: available === 0 ? 1 + Math.floor(r() * 40) : 0,
          isPet: code === 'PT',
        }
      }
      const classes = [cls('SL', 160 + km * 0.55, 216), cls('3A', 320 + km * 1.45, 128), cls('2A', 460 + km * 2.1, 48), cls('1A', 720 + km * 3.4, 24)]
      if (petFriendly) {
        // The pet coach always keeps a few cabins open so the demo flow works.
        classes.push({ ...cls('PT', 380 + km * 1.75, 24), available: 4 + Math.floor(r() * 14), waitlist: 0 })
      }
      trips.push({
        mode,
        operator: train.name,
        operatorCode: 'IR',
        color: train.color,
        number: String(12001 + Math.floor(r() * 7998)),
        from,
        to,
        date,
        depMin,
        durMin,
        stops: Math.max(1, Math.round(km / 180)),
        km,
        petFriendly,
        tatkalLeft: r() < 0.2 ? 0 : 4 + Math.floor(r() * 30),
        amenities: ['Pantry', 'Charging points', 'Bedroll'].filter(() => r() < 0.7),
        classes,
      })
    }
  }

  return trips
    .sort((a, b) => a.depMin - b.depMin)
    .map((t, i) => ({ ...t, id: [mode, fromCode, toCode, date, i].join('~') }))
}

export function getTrip(id: string): Trip | undefined {
  const [mode, from, to, date, i] = id.split('~')
  return generateTrips(mode as Mode, from, to, date)[Number(i)]
}

export const PET_SIZES: Record<PetSize, { label: string; weight: string; maxKg: number }> = {
  small: { label: 'Small', weight: 'up to 8 kg', maxKg: 8 },
  medium: { label: 'Medium', weight: '8 – 20 kg', maxKg: 20 },
  large: { label: 'Large', weight: 'over 20 kg', maxKg: 90 },
}

/** Where a pet travels. Small pets fly in-cabin; bigger ones fly in the hold. Trains always use the pet coach. */
export function petPlacement(mode: Mode, size: PetSize) {
  if (mode === 'train') return 'Pet coach cabin, with you'
  return size === 'small' ? 'In cabin, under the seat in front' : 'Climate-controlled, pressurised hold'
}
