import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FareType, Mode, PetSize, Quota, Trip } from '../lib/data'
import { api, ApiError } from '../lib/api'
import type { Quote } from '../lib/pricing'
import type { Contact, Passenger, PetInfo } from '../../../shared/rules'

export type { Passenger, PassengerType, PetInfo } from '../../../shared/rules'

/** One direction of the journey: a single trip for one-way, two for a round trip. */
export interface LegDraft {
  tripId: string
  cls: string
  seats: string[]
  bin: boolean
}

export interface Draft {
  legs: LegDraft[]
  adults: number
  children: number
  infants: number
  petSize: PetSize | null
  fareType: FareType
  quota: Quota
  holdId: string | null
  holdUntil: number | null
  passengers: Passenger[]
  pet: PetInfo
  contact: Contact
  coupon: string | null
}

export type LegStatus = 'CONFIRMED' | 'WAITLIST' | 'CANCELLED'

export interface BookingLeg {
  trip: Trip
  cls: string
  seats: string[]
  bin: boolean
  status: LegStatus
  waitlistNo?: number
}

/** A booking as returned by the API. */
export interface Booking {
  pnr: string
  createdAt: number
  mode: Mode
  legs: BookingLeg[]
  passengers: Passenger[]
  petSize: PetSize | null
  pet: PetInfo | null
  fareType: FareType
  quota: Quota
  quote: Quote
  payment: { method: 'card' | 'upi'; ref: string; status: string }
  contact: Contact
}

export interface StartInput {
  legs: { tripId: string; cls: string }[]
  adults: number
  children: number
  infants: number
  petSize: PetSize | null
  fareType: FareType
  quota: Quota
}

interface State {
  draft: Draft | null
  bookings: Booking[]
  start: (d: StartInput) => void
  update: (patch: Partial<Draft>) => void
  updateLeg: (i: number, patch: Partial<LegDraft>) => void
  /** Holds the chosen seats on the server. Returns the seats someone else got first, or [] on success. */
  hold: () => Promise<{ error: string; seats: string[] } | null>
  release: () => Promise<void>
  confirm: (quote: Quote, payment: { method: 'card' | 'upi'; ref: string }, idempotencyKey: string) => Promise<Booking>
  loadBookings: () => Promise<void>
  cancel: (pnr: string) => Promise<{ refund: number; promoted: string[] }>
  clearBookings: () => void
}

export const seatedCount = (d: Pick<Draft, 'adults' | 'children'>) => d.adults + d.children
export const isCancelled = (b: Booking) => b.legs.every((l) => l.status === 'CANCELLED')

export const useBooking = create<State>()(
  persist(
    (set, get) => ({
      draft: null,
      bookings: [],

      start: (d) => {
        void get().release()
        set({
          draft: {
            ...d,
            legs: d.legs.map((l) => ({ ...l, seats: [], bin: false })),
            holdId: null,
            holdUntil: null,
            passengers: [
              ...Array.from({ length: d.adults }, (): Passenger => ({ type: 'Adult', name: '', age: '', gender: '' })),
              ...Array.from({ length: d.children }, (): Passenger => ({ type: 'Child', name: '', age: '', gender: '' })),
              ...Array.from({ length: d.infants }, (): Passenger => ({ type: 'Infant', name: '', age: '', gender: '' })),
            ],
            pet: { name: '', type: 'Dog', breed: '', weightKg: '', vaccinatedOn: '' },
            contact: { email: '', phone: '' },
            coupon: null,
          },
        })
      },

      update: (patch) => set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : s)),

      updateLeg: (i, patch) =>
        set((s) => (s.draft ? { draft: { ...s.draft, legs: s.draft.legs.map((l, j) => (j === i ? { ...l, ...patch } : l)) } } : s)),

      hold: async () => {
        const d = get().draft
        if (!d) return { error: 'No booking in progress', seats: [] }
        await get().release()
        const legs = d.legs.filter((l) => l.seats.length)
        if (!legs.length) return null // waitlist only: nothing to hold
        try {
          const res = await api<{ holdId: string; expiresAt: number }>('/holds', {
            method: 'POST',
            json: { legs: legs.map(({ tripId, cls, seats }) => ({ tripId, cls, seats })), seated: seatedCount(d), petSize: d.petSize },
          })
          get().update({ holdId: res.holdId, holdUntil: res.expiresAt })
          return null
        } catch (e) {
          const seats = e instanceof ApiError && Array.isArray(e.details?.seats) ? (e.details.seats as string[]) : []
          return { error: e instanceof Error ? e.message : 'Could not hold seats', seats }
        }
      },

      release: async () => {
        const d = get().draft
        if (!d?.holdId) return
        const holdId = d.holdId
        get().update({ holdId: null, holdUntil: null })
        await api(`/holds/${holdId}`, { method: 'DELETE' }).catch(() => undefined)
      },

      confirm: async (quote, payment, idempotencyKey) => {
        const d = get().draft
        if (!d) throw new ApiError(400, 'No booking in progress')
        const { booking } = await api<{ booking: Booking }>('/bookings', {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey },
          json: {
            holdId: d.holdId,
            legs: d.legs,
            passengers: d.passengers,
            petSize: d.petSize,
            pet: d.petSize ? d.pet : null,
            fareType: d.fareType,
            quota: d.quota,
            coupon: quote.couponError ? null : d.coupon,
            contact: d.contact,
            payment,
          },
        })
        set({ bookings: [booking, ...get().bookings.filter((b) => b.pnr !== booking.pnr)], draft: null })
        return booking
      },

      loadBookings: async () => {
        const { bookings } = await api<{ bookings: Booking[] }>('/bookings')
        set({ bookings })
      },

      cancel: async (pnr) => {
        const res = await api<{ booking: Booking; refund: number; promoted: string[] }>(`/bookings/${pnr}/cancel`, { method: 'POST' })
        set({ bookings: get().bookings.map((b) => (b.pnr === pnr ? res.booking : b)) })
        return { refund: res.refund, promoted: res.promoted }
      },

      clearBookings: () => set({ bookings: [] }),
    }),
    // Only the in-progress draft survives a reload; bookings always come from the server.
    { name: 'skyvoyage-draft-v3', partialize: (s) => ({ draft: s.draft }) },
  ),
)
