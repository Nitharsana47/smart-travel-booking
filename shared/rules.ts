// Booking rules shared by the browser (instant feedback) and the server
// (the real check). Keeping one copy means they can never disagree.
import { addDaysISO, PET_SIZES, type FareType, type Mode, type PetSize, type Quota, type Trip } from './data'
import { flightRows, trainCoaches } from './seats'

export type PassengerType = 'Adult' | 'Child' | 'Infant'

export interface Passenger {
  type: PassengerType
  name: string
  age: number | ''
  gender: '' | 'Female' | 'Male' | 'Other'
}

export interface PetInfo {
  name: string
  type: 'Dog' | 'Cat' | 'Other'
  breed: string
  weightKg: number | ''
  vaccinatedOn: string
}

export interface Contact {
  email: string
  phone: string
}

export type Errors = Record<string, string>

const AGE_RANGE: Record<PassengerType, [number, number, string]> = {
  Adult: [12, 120, 'Adults are 12 or older'],
  Child: [2, 11, 'Children are 2–11 years'],
  Infant: [0, 1, 'Infants are under 2'],
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_RE = /^[6-9]\d{9}$/

/** Field-level validation of travellers, pet and contact. Keys look like "p0.name", "pet.weightKg", "email". */
export function validateTravellers(
  passengers: Passenger[],
  pet: PetInfo | null,
  petSize: PetSize | null,
  contact: Contact,
  rules: { mode: Mode; quota: Quota; fare: FareType },
  today: string,
): Errors {
  const e: Errors = {}
  passengers.forEach((p, i) => {
    const [lo, hi, msg] = AGE_RANGE[p.type]
    if (p.name.trim().length < 2) e[`p${i}.name`] = 'Enter the full name as on ID'
    if (p.age === '' || p.age < lo || p.age > hi) e[`p${i}.age`] = msg
    if (!p.gender) e[`p${i}.gender`] = 'Select one'
    if (p.type === 'Infant') return
    if (rules.mode === 'train' && rules.quota === 'LD' && p.type === 'Adult' && p.gender && p.gender !== 'Female') e[`p${i}.gender`] = 'Ladies quota: adult travellers must be women'
    const seniorOnly = (rules.mode === 'train' && rules.quota === 'SS') || (rules.mode === 'flight' && rules.fare === 'senior')
    if (seniorOnly && p.age !== '' && p.age < 60) e[`p${i}.age`] = 'Senior citizen bookings need every traveller to be 60+'
  })
  const adults = passengers.filter((p) => p.type === 'Adult').length
  if (adults < 1) e.passengers = 'At least one adult must travel'
  if (passengers.filter((p) => p.type === 'Infant').length > adults) e.passengers = 'Each infant needs an adult'

  if (pet && petSize) {
    if (pet.name.trim().length < 1) e['pet.name'] = "Your pet's name"
    if (!pet.breed.trim()) e['pet.breed'] = 'Breed or "mixed"'
    const min = petSize === 'small' ? 0 : petSize === 'medium' ? PET_SIZES.small.maxKg : PET_SIZES.medium.maxKg
    if (pet.weightKg === '' || pet.weightKg <= 0) e['pet.weightKg'] = 'Enter weight in kg'
    else if (pet.weightKg > PET_SIZES[petSize].maxKg || pet.weightKg <= min) e['pet.weightKg'] = `${PET_SIZES[petSize].label} pets are ${PET_SIZES[petSize].weight}`
    if (!pet.vaccinatedOn) e['pet.vaccinatedOn'] = 'Rabies vaccination date is required'
    else if (pet.vaccinatedOn > today) e['pet.vaccinatedOn'] = "Date can't be in the future"
    else if (pet.vaccinatedOn < addDaysISO(today, -365)) e['pet.vaccinatedOn'] = 'Vaccination must be within the last 12 months'
  }
  if (!EMAIL_RE.test(contact.email)) e.email = 'Enter a valid email'
  if (!PHONE_RE.test(contact.phone)) e.phone = '10-digit mobile number'
  return e
}

/** Trains can be booked on the waitlist when the class (or the Tatkal quota) is full. The pet coach never waitlists. */
export function legIsWaitlist(trip: Trip, cls: string, quota: Quota) {
  const fareClass = trip.classes.find((c) => c.code === cls)
  return trip.mode === 'train' && !!fareClass && !fareClass.isPet && (fareClass.available === 0 || (quota === 'TQ' && trip.tatkalLeft === 0))
}

/**
 * Seat rules for one leg. Returns an error message, or null when the selection is valid:
 * right number of seats, all exist, a pet row for in-cabin pets, one cabin in the pet coach.
 */
export function checkLegSeats(trip: Trip, cls: string, seatIds: string[], seated: number, petSize: PetSize | null): string | null {
  const fareClass = trip.classes.find((c) => c.code === cls)
  if (!fareClass) return `Class ${cls} isn't sold on ${trip.number}`
  if (petSize && !trip.petFriendly) return `${trip.number} doesn't carry pets`
  if (petSize && trip.mode === 'train' && !fareClass.isPet) return 'Pets travel in the Pet Coach'
  if (new Set(seatIds).size !== seatIds.length) return 'The same seat was picked twice'
  if (seatIds.length !== seated) return `Pick exactly ${seated} seat${seated === 1 ? '' : 's'}`

  const layout = trip.mode === 'flight' ? flightRows(trip, cls).flatMap((r) => r.seats) : trainCoaches(trip, cls).flatMap((c) => c.seats)
  const seats = seatIds.map((id) => layout.find((s) => s.id === id))
  if (seats.some((s) => !s)) return 'One of the seats does not exist'
  if (seats.some((s) => s!.taken)) return 'One of the seats is already booked'
  if (trip.mode === 'flight' && petSize === 'small' && !seats.some((s) => s!.tags.includes('pet'))) return 'With an in-cabin pet, one traveller must sit in a pet row'
  if (fareClass.isPet && new Set(seats.map((s) => s!.cabin)).size > 1) return 'Your party and pet must share one cabin'
  return null
}
