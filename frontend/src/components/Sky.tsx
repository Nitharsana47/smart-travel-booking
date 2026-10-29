import { animate, motion, useMotionValue } from 'framer-motion'
import { useEffect, useRef, type CSSProperties } from 'react'

/** A soft puffy cloud. Size it with className (width). */
export function Cloud({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 240 100" className={className} style={style} aria-hidden>
      <defs>
        <linearGradient id="cloud-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      <g fill="url(#cloud-fill)">
        <ellipse cx="120" cy="70" rx="108" ry="26" />
        <circle cx="78" cy="54" r="32" />
        <circle cx="126" cy="42" r="40" />
        <circle cx="172" cy="58" r="26" />
      </g>
    </svg>
  )
}

const DRIFTING = [
  { top: '12%', w: 'w-40 sm:w-56', dur: 140, delay: -20, opacity: 0.9 },
  { top: '24%', w: 'w-24 sm:w-32', dur: 110, delay: -70, opacity: 0.7 },
  { top: '6%', w: 'w-28 sm:w-40', dur: 170, delay: -120, opacity: 0.6 },
  { top: '34%', w: 'w-48 sm:w-72', dur: 190, delay: -40, opacity: 0.8 },
  { top: '18%', w: 'w-20 sm:w-28', dur: 95, delay: -10, opacity: 0.5 },
]

/** Clouds that drift across the full width on a loop. */
export function DriftingClouds({ dim = false }: { dim?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {DRIFTING.map((c, i) => (
        <div
          key={i}
          className="cloud-drift absolute left-0"
          style={{ top: c.top, ['--dur' as string]: `${c.dur}s`, ['--delay' as string]: `${c.delay}s`, opacity: dim ? c.opacity * 0.4 : c.opacity }}
        >
          <Cloud className={`${c.w} drop-shadow-[0_8px_16px_rgba(14,165,233,0.12)]`} />
        </div>
      ))}
    </div>
  )
}

/** Top-down airliner centred on (0,0), nose pointing along +x. */
export function PlaneGlyph({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`} filter="url(#plane-shadow)">
      <path d="M8 -5 L-12 -50 L-21 -50 L-12 -5Z" fill="#f1f5f9" />
      <path d="M8 5 L-12 50 L-21 50 L-12 5Z" fill="#f1f5f9" />
      <rect x="-6" y="-31" width="13" height="6" rx="3" fill="#cbd5e1" />
      <rect x="-6" y="25" width="13" height="6" rx="3" fill="#cbd5e1" />
      <path d="M-33 -4 L-46 -19 L-52 -19 L-45 -3Z" fill="#f1f5f9" />
      <path d="M-33 4 L-46 19 L-52 19 L-45 3Z" fill="#f1f5f9" />
      <path d="M46 0 C46 -4.5 41 -6.5 34 -6.5 L-34 -5 C-43 -5 -48 -3 -50 0 C-48 3 -43 5 -34 5 L34 6.5 C41 6.5 46 4.5 46 0Z" fill="#ffffff" />
      <path d="M-50 0 C-48 -3 -43 -5 -38 -5 L-38 5 C-43 5 -48 3 -50 0Z" fill="#0ea5e9" />
      <path d="M38 -3.6 C41 -3.4 43 -2 43.4 0 C43 2 41 3.4 38 3.6Z" fill="#0c4a6e" opacity="0.85" />
    </g>
  )
}

export function PlaneDefs() {
  return (
    <defs>
      <filter id="plane-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="10" stdDeviation="6" floodColor="#0369a1" floodOpacity="0.25" />
      </filter>
      <filter id="trail-blur">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>
  )
}

/**
 * A plane that flies along a curve exactly once, drawing its contrail as it goes.
 * One motion value (0 → 1) drives both the plane position and the trail length,
 * so they stay in sync. The trail fades away after the plane leaves.
 */
export function FlightPath({
  d = 'M -180 760 C 220 700 420 430 720 400 S 1200 210 1640 30',
  delay = 0.6,
  duration = 4.8,
  start = true,
  scale = 1.15,
  className = 'pointer-events-none absolute inset-0 h-full w-full',
}: {
  d?: string
  delay?: number
  duration?: number
  start?: boolean
  scale?: number
  className?: string
}) {
  const pathRef = useRef<SVGPathElement>(null)
  const planeRef = useRef<SVGGElement>(null)
  const progress = useMotionValue(0)
  const trailOpacity = useMotionValue(1)

  useEffect(() => {
    const path = pathRef.current
    const plane = planeRef.current
    if (!path || !plane) return
    const len = path.getTotalLength()
    const place = (p: number) => {
      const at = p * len
      const a = path.getPointAtLength(Math.max(0, at - 1))
      const b = path.getPointAtLength(Math.min(len, at + 1))
      const pt = path.getPointAtLength(at)
      const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
      plane.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${angle})`)
    }
    place(progress.get())
    if (!start) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      progress.set(1)
      trailOpacity.set(0)
      place(1)
      return
    }
    const flight = animate(progress, 1, {
      duration,
      delay,
      ease: [0.45, 0.05, 0.3, 1],
      onUpdate: place,
      onComplete: () => void animate(trailOpacity, 0, { duration: 2.5, delay: 1.2 }),
    })
    return () => flight.stop()
  }, [start, delay, duration, progress, trailOpacity])

  return (
    <svg className={className} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <PlaneDefs />
      <path ref={pathRef} d={d} fill="none" />
      <motion.g style={{ opacity: trailOpacity }}>
        <motion.path d={d} fill="none" stroke="#ffffff" strokeWidth={14} strokeLinecap="round" opacity={0.45} filter="url(#trail-blur)" style={{ pathLength: progress }} />
        <motion.path d={d} fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.95} style={{ pathLength: progress }} />
      </motion.g>
      <g ref={planeRef}>
        <PlaneGlyph scale={scale} />
      </g>
    </svg>
  )
}
