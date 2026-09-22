import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

/** Small capsule label above a section heading. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold tracking-[0.08em] text-accent-on-soft uppercase">
      {children}
    </span>
  )
}

/**
 * A heading where the last clause carries the accent. Passing the two halves
 * separately keeps the colour out of the copy, so a school's brand colour can
 * change without anyone editing a sentence.
 */
export function SplitHeading({
  lead,
  accent,
  className,
}: {
  lead: string
  accent: string
  className?: string
}) {
  return (
    <h2 className={className ?? 'text-[28px] leading-[1.15] font-bold tracking-[-0.03em] sm:text-[36px]'}>
      {lead} <span className="text-accent">{accent}</span>
    </h2>
  )
}

export function CheckLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[14px]">
      <span
        aria-hidden
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-on-soft"
      >
        <Check size={12} strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  )
}

/** The primary call to action: label, then an arrow in its own disc. */
export function ArrowButton({
  href,
  children,
  tone = 'accent',
}: {
  href: string
  children: React.ReactNode
  tone?: 'accent' | 'surface'
}) {
  const skin =
    tone === 'accent'
      ? 'bg-accent text-accent-ink shadow-[0_10px_26px_-12px_var(--color-accent)]'
      : 'bg-surface text-ink shadow-[var(--shadow-card)]'
  const disc = tone === 'accent' ? 'bg-accent-ink/20' : 'bg-accent-soft text-accent-on-soft'

  const inner = (
    <>
      {children}
      <span aria-hidden className={`grid size-7 place-items-center rounded-full ${disc}`}>
        <ArrowRight size={15} />
      </span>
    </>
  )

  const className = `inline-flex h-12 items-center gap-2.5 rounded-full pr-1.5 pl-5 text-sm font-semibold ${skin}`

  return href.startsWith('mailto:') ? (
    <a href={href} className={className}>{inner}</a>
  ) : (
    <Link href={href} className={className}>{inner}</Link>
  )
}
