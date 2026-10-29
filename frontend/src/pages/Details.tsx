import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Baby, Mail, PawPrint, Phone, Syringe, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FareSummary, HoldTimer, Stepper, TripHeader } from '../components/BookingParts'
import { Button, Card, PageShell } from '../components/ui'
import { validateTravellers } from '../../../shared/rules'
import { FARE_TYPES, PET_SIZES, petPlacement, QUOTAS, type FareType, type Mode, type PetSize, type Quota } from '../lib/data'
import { cn, todayISO } from '../lib/format'
import { useDraft } from '../lib/useDraft'
import { useCurrentUser } from '../store/auth'
import { useBooking, type Passenger, type PetInfo } from '../store/booking'

/** Same rules the server enforces, so errors show here before a request is ever sent. */
const validate = (passengers: Passenger[], pet: PetInfo | null, petSize: PetSize | null, contact: { email: string; phone: string }, rules: { mode: Mode; quota: Quota; fare: FareType }) =>
  validateTravellers(passengers, pet, petSize, contact, rules, todayISO())

const input = 'w-full rounded-2xl bg-sky-50/60 px-4 py-3 text-sm font-medium text-ink outline-none ring-1 ring-sky-100 transition placeholder:text-ink-soft/50 focus:bg-white focus:ring-2 focus:ring-sky-400'

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">{label}</span>
      {children}
      {error && (
        <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1 block text-xs font-semibold text-rose-500">
          {error}
        </motion.span>
      )}
    </label>
  )
}

export default function Details() {
  const ctx = useDraft()
  const update = useBooking((s) => s.update)
  const user = useCurrentUser()
  const navigate = useNavigate()
  const [touched, setTouched] = useState(false)

  // Fill in the signed-in user's details once, without overwriting anything typed.
  useEffect(() => {
    const d = useBooking.getState().draft
    if (!user || !d) return
    update({
      contact: { email: d.contact.email || user.email, phone: d.contact.phone || user.phone },
      passengers: d.passengers.map((p, i) => (i === 0 && !p.name ? { ...p, name: user.name } : p)),
    })
  }, [user, update])

  if (!ctx) return <Navigate to="/" replace />
  const { draft, legs, quote, seatsDone, mode } = ctx
  if (!seatsDone) return <Navigate to="/book/seats" replace />

  const rules = { mode, quota: draft.quota, fare: draft.fareType }
  const pet = draft.petSize ? draft.pet : null
  const errors = touched ? validate(draft.passengers, pet, draft.petSize, draft.contact, rules) : {}
  const seatOf = (i: number) => (draft.passengers[i].type === 'Infant' ? null : legs.map((l) => l.seats[i]).filter(Boolean))

  const setPassenger = (i: number, patch: Partial<Passenger>) => update({ passengers: draft.passengers.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const setPet = (patch: Partial<PetInfo>) => update({ pet: { ...draft.pet, ...patch } })

  const submit = () => {
    setTouched(true)
    const errs = validate(draft.passengers, pet, draft.petSize, draft.contact, rules)
    if (Object.keys(errs).length) {
      document.querySelector(`[data-field="${Object.keys(errs)[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    navigate('/book/payment')
  }

  const eligibility = mode === 'train' ? (draft.quota !== 'GN' ? `${QUOTAS[draft.quota].label} quota · ${QUOTAS[draft.quota].note}` : null) : draft.fareType !== 'regular' ? `${FARE_TYPES[draft.fareType].label} fare · ${FARE_TYPES[draft.fareType].note}` : null

  return (
    <PageShell>
      <Stepper current={1} />
      <div className="mx-auto mt-10 grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
        <div className="min-w-0 space-y-6">
          <Card className="space-y-4">
            {legs.map((l, i) => (
              <TripHeader key={i} trip={l.trip} cls={l.cls} label={legs.length > 1 ? (i === 0 ? 'Outbound' : 'Return') : undefined} />
            ))}
            <div className="flex justify-end">
              <HoldTimer />
            </div>
          </Card>

          {eligibility && <p className="rounded-2xl bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-800 ring-1 ring-sky-100">{eligibility}</p>}

          {draft.passengers.map((p, i) => {
            const seats = seatOf(i)
            const Icon = p.type === 'Infant' ? Baby : User
            return (
              <Card key={i}>
                <h2 className="flex flex-wrap items-center gap-3 font-display text-lg font-bold">
                  <span className={cn('grid h-9 w-9 place-items-center rounded-xl', p.type === 'Infant' ? 'bg-rose-50 text-rose-400' : 'bg-sky-100 text-sky-600')}>
                    <Icon size={18} />
                  </span>
                  {p.type} {draft.passengers.slice(0, i + 1).filter((x) => x.type === p.type).length}
                  {seats?.map((s) => (
                    <span key={s} className="rounded-lg bg-sky-500 px-2 py-0.5 text-xs font-bold text-white">
                      {s.replace('-', ' · ')}
                    </span>
                  ))}
                  {p.type === 'Infant' && <span className="text-xs font-semibold text-ink-soft">On an adult's lap</span>}
                </h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_7rem_10rem]">
                  <Field label="Full name" error={errors[`p${i}.name`]}>
                    <input data-field={`p${i}.name`} className={input} value={p.name} onChange={(e) => setPassenger(i, { name: e.target.value })} placeholder="As on government ID" />
                  </Field>
                  <Field label="Age" error={errors[`p${i}.age`]}>
                    <input data-field={`p${i}.age`} className={input} type="number" min={0} max={120} value={p.age} onChange={(e) => setPassenger(i, { age: e.target.value === '' ? '' : Number(e.target.value) })} />
                  </Field>
                  <Field label="Gender" error={errors[`p${i}.gender`]}>
                    <select data-field={`p${i}.gender`} className={input} value={p.gender} onChange={(e) => setPassenger(i, { gender: e.target.value as Passenger['gender'] })}>
                      <option value="">Select</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Other</option>
                    </select>
                  </Field>
                </div>
              </Card>
            )
          })}

          {pet && draft.petSize && (
            <Card className="relative overflow-hidden ring-amber-200">
              <PawPrint className="absolute -right-6 -top-6 h-32 w-32 rotate-12 text-amber-100" />
              <h2 className="relative flex items-center gap-3 font-display text-lg font-bold">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-paw text-white">
                  <PawPrint size={18} />
                </span>
                Pet traveller
              </h2>
              <p className="relative mt-1 text-sm text-ink-soft">
                {PET_SIZES[draft.petSize].label} ({PET_SIZES[draft.petSize].weight}) · {petPlacement(mode, draft.petSize)}
              </p>
              <div className="relative mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Pet's name" error={errors['pet.name']}>
                  <input data-field="pet.name" className={input} value={pet.name} onChange={(e) => setPet({ name: e.target.value })} placeholder="e.g. Bruno" />
                </Field>
                <Field label="Type">
                  <div className="flex gap-2">
                    {(['Dog', 'Cat', 'Other'] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setPet({ type: t })} className={cn('flex-1 rounded-2xl py-3 text-sm font-bold ring-1 transition', pet.type === t ? 'bg-paw text-white ring-paw' : 'ring-amber-200 hover:bg-paw-soft')}>
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Breed" error={errors['pet.breed']}>
                  <input data-field="pet.breed" className={input} value={pet.breed} onChange={(e) => setPet({ breed: e.target.value })} placeholder="e.g. Beagle, mixed" />
                </Field>
                <Field label="Weight (kg)" error={errors['pet.weightKg']}>
                  <input data-field="pet.weightKg" className={input} type="number" step="0.1" min={0} value={pet.weightKg} onChange={(e) => setPet({ weightKg: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label="Rabies vaccination date" error={errors['pet.vaccinatedOn']} className="sm:col-span-2">
                  <div className="relative">
                    <Syringe size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" />
                    <input data-field="pet.vaccinatedOn" className={cn(input, 'pl-11')} type="date" max={todayISO()} value={pet.vaccinatedOn} onChange={(e) => setPet({ vaccinatedOn: e.target.value })} />
                  </div>
                </Field>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="font-display text-lg font-bold">Where should we send your tickets?</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Email" error={errors.email}>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sky-400" />
                  <input data-field="email" className={cn(input, 'pl-11')} type="email" value={draft.contact.email} onChange={(e) => update({ contact: { ...draft.contact, email: e.target.value } })} placeholder="you@example.com" autoComplete="email" />
                </div>
              </Field>
              <Field label="Mobile" error={errors.phone}>
                <div className="relative">
                  <Phone size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sky-400" />
                  <span className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-soft">+91</span>
                  <input data-field="phone" className={cn(input, 'pl-[4.6rem]')} inputMode="numeric" maxLength={10} value={draft.contact.phone} onChange={(e) => update({ contact: { ...draft.contact, phone: e.target.value.replace(/\D/g, '') } })} placeholder="98765 43210" autoComplete="tel-national" />
                </div>
              </Field>
            </div>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <FareSummary quote={quote} petSize={draft.petSize} mode={mode}>
            <Button className="w-full" onClick={submit}>
              Continue to payment <ArrowRight size={17} />
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate('/book/seats')}>
              <ArrowLeft size={16} /> Change seats
            </Button>
          </FareSummary>
        </aside>
      </div>
    </PageShell>
  )
}
