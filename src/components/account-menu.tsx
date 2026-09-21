'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { cn, initials } from '@/lib/utils'

/**
 * The account cluster in both top bars: avatar, name, and a menu holding
 * sign-out. It replaces the bare "Sign out" link that used to hang off the end
 * of the header, which read as an accident rather than a control.
 */
export function AccountMenu({
  name,
  meta,
  email,
  links = [],
}: {
  name: string
  meta: string
  email?: string
  links?: { href: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // Dismiss on an outside pointer or Escape. Without both, a menu opened by
  // touch on a phone can only be closed by navigating away.
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex h-11 items-center gap-2 rounded-full pr-2 pl-1 transition-colors sm:gap-2.5',
          open ? 'bg-surface shadow-[var(--shadow-card)]' : 'hover:bg-surface',
        )}
      >
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-ink"
        >
          {initials(name)}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-[13px] leading-tight font-semibold">{name}</span>
          <span className="block truncate text-[11px] leading-tight text-ink-muted capitalize">{meta}</span>
        </span>
        <ChevronDown aria-hidden size={16} className="shrink-0 text-ink-muted" />
        <span className="sr-only">Account menu</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-[18px] bg-surface p-1.5 shadow-[var(--shadow-raised)]"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-[12px] text-ink-muted">{email ?? meta}</p>
          </div>
          {links.length > 0 ? (
            <div className="border-t border-line pt-1.5">
              {links.map((link) => (
                <Link
                  key={link.href}
                  role="menuitem"
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex h-10 items-center rounded-xl px-3 text-[13px] font-medium text-ink-muted hover:bg-canvas hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
          <form action="/auth/signout" method="post" className="border-t border-line pt-1.5">
            <button
              role="menuitem"
              type="submit"
              className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-danger hover:bg-canvas"
            >
              <LogOut aria-hidden size={15} />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
