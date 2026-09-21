import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, DataTable, EmptyState, PageHeader, Td, Th } from '@/components/ui/primitives'
import { PrintButton } from '@/components/print-button'
import { StaffForm } from '@/components/staff/staff-form'
import type { EmploymentStatus } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Staff' }

const TONE: Record<EmploymentStatus, 'positive' | 'warn' | 'neutral'> = {
  active: 'positive',
  on_leave: 'warn',
  resigned: 'neutral',
  terminated: 'neutral',
}

export default async function StaffPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('staff')
    .select('id, staff_number, full_name, email, phone, designation, employment_status')
    .eq('school_id', ctx.school.id)
    .order('full_name')
    .limit(500)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        description={`${data?.length ?? 0} record${data?.length === 1 ? '' : 's'}`}
        actions={
          <>
            <PrintButton />
            <Link
              href="/staff/import"
              className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
            >
              Import CSV
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          {error ? (
            <EmptyState title="Could not load staff" description={error.message} />
          ) : data && data.length > 0 ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Staff no.</Th>
                  <Th>Name</Th>
                  <Th className="hidden sm:table-cell">Designation</Th>
                  <Th className="hidden md:table-cell">Phone</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-mono text-[13px]">{s.staff_number}</Td>
                    <Td className="font-medium">{s.full_name}</Td>
                    <Td className="hidden sm:table-cell">{s.designation ?? '—'}</Td>
                    <Td className="hidden tabular-nums md:table-cell">{s.phone ?? '—'}</Td>
                    <Td>
                      <Badge tone={TONE[s.employment_status]} className="capitalize">
                        {s.employment_status.replace('_', ' ')}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState
              title="No staff yet"
              description="Add teachers and administrators so they can be assigned to class arms."
            />
          )}
        </Card>

        <div className="no-print">
          <StaffForm />
        </div>
      </div>
    </div>
  )
}
