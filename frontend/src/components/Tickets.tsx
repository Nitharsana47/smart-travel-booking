import { Baby, PawPrint, Plane, Syringe, TrainFront } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { forwardRef } from 'react'
import { PET_SIZES, rng } from '../lib/data'
import { binFor } from '../lib/seats'
import { cn, fmtDate, fmtDuration, fmtTime } from '../lib/format'
import type { Booking, BookingLeg, Passenger } from '../store/booking'
import { OperatorLogo } from './Brand'

/** Decorative barcode whose bars are derived from the text, so each ticket gets its own. */
function Barcode({ value, className }: { value: string; className?: string }) {
  const r = rng(value)
  let x = 0
  const bars: { x: number; w: number }[] = []
  while (x < 200) {
    const w = 1 + Math.floor(r() * 3)
    bars.push({ x, w })
    x += w + 1 + Math.floor(r() * 3)
  }
  return (
    <svg viewBox="0 0 200 40" preserveAspectRatio="none" className={className} aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="40" fill="#0b2239" />
      ))}
    </svg>
  )
}

/** Dashed tear line with notches cut out of the ticket edge (notches match the page background). */
function Perforation() {
  return (
    <div className="relative hidden w-0 sm:block">
      <span className="absolute -left-4 -top-4 h-8 w-8 rounded-full bg-sky-50" />
      <span className="absolute inset-y-6 left-0 border-l-2 border-dashed border-sky-200" />
      <span className="absolute -bottom-4 -left-4 h-8 w-8 rounded-full bg-sky-50" />
    </div>
  )
}

function Info({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">{label}</p>
      <p className={cn('truncate font-bold text-ink', big ? 'font-display text-2xl' : 'text-sm')}>{value}</p>
    </div>
  )
}

function statusText(b: Booking, leg: BookingLeg, i: number) {
  if (leg.status === 'CANCELLED') return 'Cancelled'
  if (leg.status === 'WAITLIST') return `${b.quota === 'TQ' ? 'TQWL' : 'WL'} ${leg.waitlistNo}`
  return leg.trip.mode === 'flight' ? leg.seats[i] : leg.seats[i]?.replace('-', ' / ')
}

export const PassengerTicket = forwardRef<HTMLDivElement, { booking: Booking; leg: BookingLeg; passenger: Passenger; index: number; infant?: Passenger; label?: string }>(function PassengerTicket(
  { booking: b, leg, passenger, index, infant, label },
  ref,
) {
  const { trip } = leg
  const flight = trip.mode === 'flight'
  const r = rng(b.pnr + trip.id + index)
  const gate = `${'ABC'[Math.floor(r() * 3)]}${1 + Math.floor(r() * 24)}`
  const arr = trip.depMin + trip.durMin
  const fareClass = trip.classes.find((c) => c.code === leg.cls)
  const code = (c: typeof trip.from) => (flight ? c.code : c.station)
  const Icon = flight ? Plane : TrainFront

  return (
    <div ref={ref} className="print-break flex flex-col overflow-hidden rounded-[28px] bg-white shadow-float ring-1 ring-sky-100 sm:flex-row">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 px-6 py-4 text-white" style={{ background: `linear-gradient(100deg, ${trip.color}, ${trip.color}b3)` }}>
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-white/90 p-0.5">
              <OperatorLogo trip={trip} className="h-9 w-9" />
            </span>
            <div>
              <p className="font-display font-bold leading-tight">{trip.operator}</p>
              <p className="text-xs text-white/80">
                {label ? `${label} · ` : ''}
                {flight ? 'Boarding pass' : 'Electronic reservation slip'}
              </p>
            </div>
          </div>
          <span className={cn('rounded-full px-3 py-1 text-xs font-bold', leg.status === 'CONFIRMED' ? 'bg-white text-emerald-600' : leg.status === 'WAITLIST' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600')}>
            {leg.status === 'CONFIRMED' ? 'Confirmed' : leg.status === 'WAITLIST' ? 'Waitlisted' : 'Cancelled'}
          </span>
        </div>

        <div className="px-6 pb-6 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-4xl font-extrabold tracking-tight">{code(trip.from)}</p>
              <p className="text-sm text-ink-soft">{trip.from.name}</p>
              <p className="mt-1 font-mono font-bold">{fmtTime(trip.depMin)}</p>
            </div>
            <div className="relative flex flex-1 flex-col items-center">
              <svg viewBox="0 0 200 50" className="h-12 w-full" aria-hidden>
                <path d="M6 44 Q100 -6 194 44" fill="none" stroke="#bae6fd" strokeWidth="2" strokeDasharray="4 5" />
                <circle cx="6" cy="44" r="4" fill="#0ea5e9" />
                <circle cx="194" cy="44" r="4" fill="#0ea5e9" />
              </svg>
              <Icon size={18} className="absolute top-1 text-sky-500" />
              <p className="text-xs font-semibold text-ink-soft">{fmtDuration(trip.durMin)}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl font-extrabold tracking-tight">{code(trip.to)}</p>
              <p className="text-sm text-ink-soft">{trip.to.name}</p>
              <p className="mt-1 font-mono font-bold">
                {fmtTime(arr)}
                {arr >= 1440 && <sup className="text-amber-600"> +{Math.floor(arr / 1440)}</sup>}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-dashed border-sky-100 pt-5 sm:grid-cols-4">
            <Info label="Passenger" value={passenger.name || `Traveller ${index + 1}`} />
            <Info label={flight ? 'Flight' : 'Train'} value={trip.number} />
            <Info label="Date" value={fmtDate(trip.date, { day: 'numeric', month: 'short', year: 'numeric' })} />
            <Info label="Class" value={fareClass?.name ?? leg.cls} />
            {flight ? (
              <>
                <Info label="Boarding" value={fmtTime(trip.depMin - 40)} />
                <Info label="Gate" value={gate} />
                <Info label="Overhead bin" value={leg.bin && leg.seats[index] ? binFor(leg.seats[index]) : '—'} />
                <Info label="Age / Gender" value={`${passenger.age} / ${passenger.gender[0] ?? '-'}`} />
              </>
            ) : (
              <>
                <Info label="Coach" value={leg.seats[index]?.split('-')[0] ?? '—'} />
                <Info label="Berth" value={leg.seats[index]?.split('-')[1] ?? '—'} />
                <Info label="Quota" value={{ GN: 'General', TQ: 'Tatkal', LD: 'Ladies', SS: 'Senior citizen' }[b.quota]} />
                <Info label="Age / Gender" value={`${passenger.age} / ${passenger.gender[0] ?? '-'}`} />
              </>
            )}
          </div>
          {infant && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-500 ring-1 ring-rose-100">
              <Baby size={14} /> With lap infant: {infant.name} ({infant.age === 0 ? 'under 1' : '1 yr'})
            </p>
          )}
        </div>
      </div>

      <Perforation />

      <div className="flex items-center justify-between gap-4 border-t-2 border-dashed border-sky-100 bg-sky-50/60 p-6 sm:w-60 sm:flex-col sm:justify-center sm:border-t-0">
        <div className="sm:text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">{leg.status !== 'CONFIRMED' ? 'Status' : flight ? 'Seat' : 'Berth'}</p>
          <p className="font-display text-4xl font-extrabold text-sky-600">{statusText(b, leg, index)}</p>
          <p className="mt-1 font-mono text-sm font-bold">PNR {b.pnr}</p>
        </div>
        <div className="rounded-2xl bg-white p-2.5 ring-1 ring-sky-100">
          <QRCodeSVG value={JSON.stringify({ pnr: b.pnr, name: passenger.name, seat: leg.seats[index] ?? null, trip: trip.number, date: trip.date })} size={104} fgColor="#0b2239" level="M" />
        </div>
        <Barcode value={b.pnr + trip.id + index} className="hidden h-8 w-full sm:block" />
      </div>
    </div>
  )
})

export const PetPass = forwardRef<HTMLDivElement, { booking: Booking }>(function PetPass({ booking: b }, ref) {
  if (!b.pet || !b.petSize) return null
  const firstSeat = b.legs[0].seats[0]
  const where =
    b.mode === 'train'
      ? firstSeat
        ? `Coach ${firstSeat.split('-')[0]} · Cabin ${Math.ceil(Number(firstSeat.split('-')[1]) / 4)}`
        : 'Pet coach'
      : b.petSize === 'small'
        ? 'In cabin'
        : 'Pet hold'
  return (
    <div ref={ref} className="print-break relative flex flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-50 via-white to-sky-50 shadow-float ring-1 ring-amber-200 sm:flex-row">
      <PawPrint className="pointer-events-none absolute -bottom-10 left-1/3 h-48 w-48 -rotate-12 text-amber-100" />
      <div className="relative flex-1 p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-paw text-white shadow-soft">
            <PawPrint size={24} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Pet pass</p>
            <p className="font-display text-3xl font-extrabold">{b.pet.name}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Info label="Type" value={b.pet.type} />
          <Info label="Breed" value={b.pet.breed} />
          <Info label="Weight" value={`${b.pet.weightKg} kg · ${PET_SIZES[b.petSize].label}`} />
          <Info label="Travels" value={where} />
        </div>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
          <Syringe size={14} /> Rabies vaccine verified · {fmtDate(b.pet.vaccinatedOn, { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <Perforation />
      <div className="relative flex items-center justify-center gap-4 border-t-2 border-dashed border-amber-200 p-6 sm:w-60 sm:flex-col sm:border-t-0">
        <div className="rounded-2xl bg-white p-2.5 ring-1 ring-amber-200">
          <QRCodeSVG value={JSON.stringify({ pnr: b.pnr, pet: b.pet.name, size: b.petSize })} size={96} fgColor="#92400e" />
        </div>
        <p className="font-mono text-sm font-bold">PNR {b.pnr}</p>
      </div>
    </div>
  )
})
