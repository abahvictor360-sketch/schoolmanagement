'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  BookOpen, CalendarCheck, ClipboardList, GraduationCap, LayoutDashboard, Menu,
  MessageSquare, Settings, ShieldCheck, Users, UserSquare2, Wallet, X,
} from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import type { SchoolContext } from '@/lib/auth'
import { SchoolSwitcher } from '@/components/school-switcher'
import { SchoolMark } from '@/components/school-mark'

type NavItem = { href: string; label: string; icon: typeof Users; roles?: string[] }

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/assessments', label: 'Assessments', icon: ClipboardList },
  { href: '/fees', label: 'Fees', icon: Wallet, roles: ['school_admin', 'bursar'] },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/students', label: 'Students', icon: GraduationCap, roles: ['school_admin'] },
  { href: '/guardians', label: 'Guardians', icon: Users, roles: ['school_admin'] },
  { href: '/staff', label: 'Staff', icon: UserSquare2, roles: ['school_admin'] },
  { href: '/enrollment', label: 'Enrollment', icon: BookOpen, roles: ['school_admin'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['school_admin'] },
]

export function AppShell({
  ctx,
  schools,
  children,
}: {
  ctx: SchoolContext
  schools: { id: string; name: string; role: string }[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const items = NAV.filter((item) => !item.roles || item.roles.includes(ctx.role) || ctx.isPlatformAdmin)

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5 p-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[14px] transition-colors',
              active
                ? 'bg-accent-soft font-semibold text-accent-on-soft'
                : 'font-medium text-ink-muted hover:bg-canvas hover:text-ink',
            )}
          >
            <Icon aria-hidden size={18} />
            {label}
          </Link>
        )
      })}
      {ctx.isPlatformAdmin ? (
        <Link
          href="/platform"
          onClick={() => setOpen(false)}
          className="mt-2 flex h-12 items-center gap-3 rounded-2xl bg-canvas px-3.5 text-[14px] font-medium text-ink-muted hover:text-ink"
        >
          <ShieldCheck aria-hidden size={18} />
          Platform admin
        </Link>
      ) : null}
    </nav>
  )

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="no-print hidden w-64 shrink-0 bg-surface lg:block">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <SchoolMark name={ctx.school.name} logoUrl={ctx.school.logo_url} />
          <span className="truncate text-[16px] font-bold tracking-[-0.02em]">{ctx.school.name}</span>
        </div>
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-surface shadow-xl">
            <div className="flex h-16 items-center justify-between px-4">
              <span className="flex min-w-0 items-center gap-2">
                <SchoolMark name={ctx.school.name} logoUrl={ctx.school.logo_url} size="sm" />
                <span className="truncate text-[15px] font-bold tracking-[-0.02em]">{ctx.school.name}</span>
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-2">
                <X size={18} />
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 bg-canvas/85 px-3 backdrop-blur sm:px-5">
          <button
            className="-ml-1 p-2 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu size={20} />
          </button>

          <SchoolSwitcher current={ctx.school} schools={schools} />

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] leading-tight font-medium">{ctx.fullName}</p>
              <p className="text-[11px] leading-tight text-ink-muted capitalize">
                {ctx.role.replace('_', ' ')}
              </p>
            </div>
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-full bg-accent text-[13px] font-bold text-white"
            >
              {initials(ctx.fullName)}
            </span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-[13px] text-ink-muted underline-offset-2 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 p-3 sm:p-5 sm:pt-1">
          <div className="print-only mb-4 flex items-center gap-3">
            <SchoolMark name={ctx.school.name} logoUrl={ctx.school.logo_url} />
            <p className="text-lg font-semibold">{ctx.school.name}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
