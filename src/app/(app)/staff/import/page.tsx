import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { PageHeader } from '@/components/ui/primitives'
import { StaffImport } from '@/components/staff/staff-import'

export const metadata: Metadata = { title: 'Import staff' }

export default async function ImportStaffPage() {
  await requireRole('school_admin')
  return (
    <div className="space-y-4">
      <PageHeader title="Import staff" description="Review every row before anything is written." />
      <StaffImport />
    </div>
  )
}
