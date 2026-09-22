'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#security', label: 'Security' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

/**
 * Transparent while it sits over the hero's wash, and only takes a background
 * once the page scrolls under it. A permanently tinted bar drew a hard seam
 * across the top of the gradient.
 */
export function MarketingHeader({
  primaryHref,
  primaryLabel,
  showSignIn,
}: {
  primaryHref: string
  primaryLabel: string
  /** False when the primary button is itself Sign in, so it is not shown twice. */
  showSignIn: boolean
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-40 transition-colors ${
        scrolled ? 'bg-canvas/85 backdrop-blur' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-ink">
            <GraduationCap size={19} aria-hidden />
          </span>
          <span className="text-[17px] font-bold tracking-[-0.02em]">SchoolHub</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden h-10 items-center rounded-xl px-3 text-[13px] font-semibold text-ink-muted hover:text-ink md:inline-flex"
            >
              {item.label}
            </Link>
          ))}
          {showSignIn ? (
            <Link
              href="/login"
              className="ml-2 hidden h-10 items-center px-2 text-[13px] font-semibold text-ink-muted hover:text-ink sm:inline-flex"
            >
              Sign in
            </Link>
          ) : null}
          <Link
            href={primaryHref}
            className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-ink"
          >
            {primaryLabel}
          </Link>
        </nav>
      </div>
    </header>
  )
}
