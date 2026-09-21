'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, ClipboardList, Home, MessageSquare, PenSquare, Wallet } from 'lucide-react'
import { SchoolMark } from '@/components/school-mark'
import { AccountMenu } from '@/components/account-menu'
import { HeaderIconLink } from '@/components/header-icon-link'
import { cn } from '@/lib/utils'
import type { StudentContext } from '@/lib/student'

const NAV = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/portal/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/portal/results', label: 'Results', icon: ClipboardList },
  { href: '/portal/tests', label: 'Tests', icon: PenSquare },
  { href: '/portal/fees', label: 'Fees', icon: Wallet },
  { href: '/portal/messages', label: 'Messages', icon: MessageSquare },
]

/**
 * The pupil's shell. Navigation sits at the bottom on a phone, where a thumb
 * reaches, and moves to the side on a wider screen.
 */
export function PortalShell({
  ctx,
  unreadMessages = 0,
  children,
}: {
  ctx: StudentContext
  unreadMessages?: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === '/portal' ? pathname === '/portal' : pathname.startsWith(href)

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="no-print hidden w-60 shrink-0 bg-surface lg:block">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <SchoolMark name={ctx.school.name} logoUrl={ctx.school.logo_url} />
          <span className="truncate text-[15px] font-bold tracking-[-0.02em]">{ctx.school.name}</span>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5 p-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[14px] transition-colors',
                isActive(href)
                  ? 'bg-accent-soft font-semibold text-accent-on-soft'
                  : 'font-medium text-ink-muted hover:bg-canvas hover:text-ink',
              )}
            >
              <Icon aria-hidden size={18} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 bg-canvas/85 px-4 backdrop-blur">
          <span className="flex min-w-0 items-center gap-2 lg:hidden">
            <SchoolMark name={ctx.school.name} logoUrl={ctx.school.logo_url} size="sm" />
            <span className="truncate text-sm font-semibold">{ctx.school.name}</span>
          </span>
          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            <HeaderIconLink
              href="/portal/messages"
              label="Messages"
              count={unreadMessages}
              icon={MessageSquare}
            />
            <AccountMenu
              name={`${ctx.student.first_name} ${ctx.student.last_name}`}
              meta={ctx.enrollment?.class_label ?? 'Not enrolled'}
            />
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 p-3 pb-24 sm:p-5 lg:pb-5">
          <div className="print-only mb-4 flex items-center gap-3">
            <SchoolMark name={ctx.school.name} logoUrl={ctx.school.logo_url} />
            <p className="text-lg font-semibold">{ctx.school.name}</p>
          </div>
          {children}
        </main>
      </div>

      {/* Thumb-reachable navigation on a phone. */}
      <nav
        aria-label="Main"
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 bg-surface shadow-[0_-4px_20px_-12px_rgba(22,17,46,0.25)] lg:hidden"
      >
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={cn(
              'flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium',
              isActive(href) ? 'text-accent-on-soft' : 'text-ink-muted',
            )}
          >
            <Icon aria-hidden size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
