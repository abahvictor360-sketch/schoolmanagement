import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { PageHeader } from '@/components/ui/primitives'
import { SettingsNav } from '@/components/settings/nav'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireRole('school_admin')
  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Academic rules here are data. Changing them never needs a code change."
        actions={
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
          >
            Back to dashboard
          </Link>
        }
      />
      <SettingsNav />
      {children}
    </div>
  )
}
