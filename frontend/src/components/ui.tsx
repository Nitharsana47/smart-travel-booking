import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/format'
import { BrandMark, Wordmark } from './Brand'

export const EASE = [0.22, 1, 0.36, 1] as const

/** Fades and slides its children in the first time they scroll into view. */
export function Reveal({ children, delay = 0, y = 32, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeading({ eyebrow, title, sub, center }: { eyebrow: string; title: ReactNode; sub?: string; center?: boolean }) {
  return (
    <Reveal className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-100">
        {eyebrow}
      </p>
      <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">{title}</h2>
      {sub && <p className="mt-4 text-lg leading-relaxed text-ink-soft">{sub}</p>}
    </Reveal>
  )
}

export function Logo({ light, tagline }: { light?: boolean; tagline?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="SkyVoyage home">
      <span className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
        <BrandMark className="h-11 w-11 drop-shadow-[0_8px_16px_rgba(3,105,161,0.35)]" />
      </span>
      <Wordmark light={light} tagline={tagline} />
    </Link>
  )
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' }) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-[0_12px_30px_-10px_rgb(2_132_199/0.7)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-12px_rgb(2_132_199/0.8)] disabled:hover:translate-y-0',
        variant === 'soft' && 'bg-sky-50 text-sky-700 ring-1 ring-sky-100 hover:bg-sky-100',
        variant === 'ghost' && 'text-ink-soft hover:bg-sky-50 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-3xl bg-white p-6 shadow-soft ring-1 ring-sky-100/80', className)}>{children}</div>
}

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn('min-h-screen bg-gradient-to-b from-sky-50 via-white to-white pb-24 pt-24', className)}
    >
      {children}
    </motion.main>
  )
}
