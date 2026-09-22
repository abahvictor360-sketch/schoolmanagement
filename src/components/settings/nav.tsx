'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/settings', label: 'School profile' },
  { href: '/settings/academic', label: 'Academic rules' },
  { href: '/settings/classes', label: 'Classes and subjects' },
  { href: '/settings/branding', label: 'Branding' },
  { href: '/settings/payments', label: 'Payments' },
  { href: '/settings/billing', label: 'Subscription' },
  { href: '/settings/people', label: 'Access' },
  { href: '/settings/audit', label: 'Audit log' },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Settings" className="no-print flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium',
              active ? 'border-accent text-accent-on-soft' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
