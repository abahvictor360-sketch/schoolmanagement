'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, ClipboardList, Home, MessageSquare, PenSquare } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import type { StudentContext } from '@/lib/student'

const NAV = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/portal/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/portal/results', label: 'Results', icon: ClipboardList },
  { href: '/portal/tests', label: 'Tests', icon: PenSquare },
  { href: '/portal/messages', label: 'Messages', icon: MessageSquare },
]

/**
 * The pupil's shell. Navigation sits at the bottom on a phone, where a thumb
 * reaches, and moves to the side on a wider screen.
 */
export function PortalShell({
  ctx,
  children,
}: {
  ctx: StudentContext
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === '/portal' ? pathname === '/portal' : pathname.startsWith(href)

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="no-print hidden w-56 shrink-0 border-r border-line bg-surface lg:block">
        <div className="flex h-14 items-center px-5 text-[15px] font-semibold tracking-[-0.02em]">
          {ctx.school.name}
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5 p-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                isActive(href)
                  ? 'bg-accent-soft font-medium text-accent'
                  : 'text-ink-muted hover:bg-canvas hover:text-ink',
              )}
            >
              <Icon aria-hidden size={18} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
          <span className="truncate text-sm font-medium lg:hidden">{ctx.school.name}</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] leading-tight font-medium">
                {ctx.student.first_name} {ctx.student.last_name}
              </p>
              <p className="text-[11px] leading-tight text-ink-muted">
                {ctx.enrollment?.class_label ?? 'Not enrolled'}
              </p>
            </div>
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent"
            >
              {initials(`${ctx.student.first_name} ${ctx.student.last_name}`)}
            </span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-[13px] text-ink-muted underline-offset-2 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 p-3 pb-24 sm:p-5 lg:pb-5">
          <div className="print-only mb-4">
            <p className="text-lg font-semibold">{ctx.school.name}</p>
          </div>
          {children}
        </main>
      </div>

      {/* Thumb-reachable navigation on a phone. */}
      <nav
        aria-label="Main"
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface lg:hidden"
      >
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={cn(
              'flex h-16 flex-col items-center justify-center gap-1 text-[11px]',
              isActive(href) ? 'text-accent' : 'text-ink-muted',
            )}
          >
            <Icon aria-hidden size={19} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
