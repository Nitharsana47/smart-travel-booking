import { useId } from 'react'
import type { Trip } from '../lib/data'
import { cn } from '../lib/format'

/** Top-down plane centred on (0,0), nose along +x, about 16 units long. */
const PLANE = 'M8 0C8-1.1 7-1.6 5.4-1.6H2L-2.6-8H-5L-2.4-1.6H-5.6L-7.2-4H-8.8L-7.8 0-8.8 4H-7.2L-5.6 1.6H-2.4L-5 8H-2.6L2 1.6H5.4C7 1.6 8 1.1 8 0Z'

/**
 * SkyVoyage mark: a plane climbing away from a paw print, with a dotted
 * contrail between them and a horizon arc. Pets and travel in one symbol.
 */
export function BrandMark({ className = 'h-10 w-10' }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.5" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
        <radialGradient id={`${id}sun`} cx="0.8" cy="0.2" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${id}bg)`} />
      <rect width="48" height="48" rx="14" fill={`url(#${id}sun)`} />
      <path d="M4 37C14 31 34 31 44 37" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.6" fill="none" />
      <path d="M15 33C20 31 25.5 26 29.5 19.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="0.01 3.6" fill="none" />
      <path d={PLANE} transform="translate(33.5 14) rotate(-52) scale(1.25)" fill="#fff" />
      <g transform="translate(11 34.5)" fill="#fbbf24">
        <ellipse cx="0" cy="1.6" rx="3" ry="2.5" />
        <circle cx="-3.1" cy="-2" r="1.25" />
        <circle cx="-1.1" cy="-3.7" r="1.25" />
        <circle cx="1.1" cy="-3.7" r="1.25" />
        <circle cx="3.1" cy="-2" r="1.25" />
      </g>
    </svg>
  )
}

export function Wordmark({ light, tagline }: { light?: boolean; tagline?: boolean }) {
  return (
    <span className="flex flex-col leading-none">
      <span className={cn('font-display text-[1.35rem] font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>
        Sky
        <span className={cn('bg-clip-text text-transparent', light ? 'bg-gradient-to-r from-sky-300 to-cyan-200' : 'bg-gradient-to-r from-sky-500 to-sky-700')}>Voyage</span>
      </span>
      {tagline && <span className={cn('mt-1 text-[10px] font-bold uppercase tracking-[0.22em]', light ? 'text-sky-200/80' : 'text-ink-soft')}>Flights · Trains · Pets</span>}
    </span>
  )
}

// ---------------------------------------------------------------- operators

function Tile({ from, to, children, className }: { from: string; to: string; children: React.ReactNode; className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      {children}
    </svg>
  )
}

const AIRLINE_MARKS: Record<string, (c: string) => React.ReactNode> = {
  SV: (c) => <BrandMark className={c} />,
  // Monsoon Air: raindrop over a wave
  MN: (c) => (
    <Tile from="#2dd4bf" to="#0f766e" className={c}>
      <path d="M24 9C24 9 15.5 19.5 15.5 25.5A8.5 8.5 0 0 0 32.5 25.5C32.5 19.5 24 9 24 9Z" fill="#fff" />
      <path d="M20 26.5A4 4 0 0 0 24 30.5" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M9 38Q13 35 17 38T25 38T33 38T41 38" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </Tile>
  ),
  // Saffron Wings: three sweeping feathers
  SW: (c) => (
    <Tile from="#fbbf24" to="#ea580c" className={c}>
      <path d="M9 33C17 21 28 14 40 12C33 17 27 23 23 31Z" fill="#fff" />
      <path d="M12 37C19 30 27 26 37 24C31 28 27 32 24 36Z" fill="#fff" opacity="0.8" />
      <path d="M16 40C21 37 27 35 33 34C29 36.5 26.5 38.5 24.5 40.5Z" fill="#fff" opacity="0.6" />
    </Tile>
  ),
  // BlueJay Airways: a bird in flight
  BJ: (c) => (
    <Tile from="#818cf8" to="#4338ca" className={c}>
      <path d="M8 23C14 17 21 18 25 24C29 15 36 12 41 12C37 18 34 26 27 31C21 35 13 32 8 23Z" fill="#fff" />
      <path d="M27 31L33 37L26 35Z" fill="#fff" opacity="0.8" />
      <circle cx="16" cy="22.5" r="1.4" fill="#4338ca" />
    </Tile>
  ),
}

/** Front of a train: body, windscreen, headlights. Each train line gets its own colour. */
function TrainMark({ color, className }: { color: string; className?: string }) {
  return (
    <Tile from={color} to="#0b2239" className={className}>
      <rect x="13" y="8" width="22" height="27" rx="7" fill="#fff" />
      <rect x="16.5" y="12" width="15" height="9" rx="2.5" fill={color} />
      <circle cx="18.5" cy="28" r="2" fill="#fbbf24" />
      <circle cx="29.5" cy="28" r="2" fill="#fbbf24" />
      <path d="M17 35L13 41M31 35L35 41" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10 41H38" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
    </Tile>
  )
}

export function OperatorLogo({ trip, className = 'h-12 w-12' }: { trip: Pick<Trip, 'mode' | 'operatorCode' | 'color'>; className?: string }) {
  if (trip.mode === 'train') return <TrainMark color={trip.color} className={className} />
  const mark = AIRLINE_MARKS[trip.operatorCode]
  return <span className="shrink-0 drop-shadow-sm">{mark ? mark(className) : <BrandMark className={className} />}</span>
}
