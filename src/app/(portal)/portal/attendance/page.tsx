import type { Metadata } from 'next'
import { requireStudent } from '@/lib/student'
import { createClient } from '@/lib/supabase/server'
import {
  Badge, Card, CardHeader, CardTitle, DataTable, EmptyState, PageHeader, Td, Th,
} from '@/components/ui/primitives'
import { PrintButton } from '@/components/print-button'
import type { AttendanceStatus } from '@/lib/database.types'

export const metadata: Metadata = { title: 'My attendance' }

const TONE: Record<AttendanceStatus, 'positive' | 'danger' | 'warn' | 'accent'> = {
  present: 'positive',
  absent: 'danger',
  late: 'warn',
  excused: 'accent',
}

export default async function PortalAttendance() {
  const ctx = await requireStudent()
  if (!ctx.enrollment) {
    return (
      <Card>
        <EmptyState title="Not enrolled this term" description="There is no register to show yet." />
      </Card>
    )
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('attendance_entries')
    .select('id, status, note, register:attendance_registers(register_date)')
    .eq('enrollment_id', ctx.enrollment.id)
    .returns<{
      id: string
      status: AttendanceStatus
      note: string | null
      register: { register_date: string } | null
    }[]>()

  const rows = (data ?? []).sort((a, b) =>
    (b.register?.register_date ?? '').localeCompare(a.register?.register_date ?? ''),
  )

  const counts = {
    present: rows.filter((r) => r.status === 'present').length,
    absent: rows.filter((r) => r.status === 'absent').length,
    late: rows.filter((r) => r.status === 'late').length,
    excused: rows.filter((r) => r.status === 'excused').length,
  }
  const rate = rows.length === 0 ? 0 : Math.round(((counts.present + counts.late) / rows.length) * 100)

  return (
    <div className="space-y-4">
      <PageHeader
        title="My attendance"
        description={`${ctx.enrollment.session_label} · ${ctx.enrollment.term_label}`}
        actions={<PrintButton />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ['Rate', `${rate}%`],
            ['Present', counts.present],
            ['Absent', counts.absent],
            ['Late', counts.late],
            ['Excused', counts.excused],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <div className="px-4 py-3">
              <p className="text-lg font-semibold tabular-nums">{value}</p>
              <p className="text-[12px] text-ink-muted">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Every mark this term</CardTitle>
          <Badge>{rows.length} days</Badge>
        </CardHeader>
        {rows.length === 0 ? (
          <EmptyState
            title="No attendance recorded yet"
            description="Marks appear here after your teacher takes the register."
          />
        ) : (
          <DataTable className="min-w-0">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th className="hidden sm:table-cell">Note</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="tabular-nums">{r.register?.register_date ?? '—'}</Td>
                  <Td>
                    <Badge tone={TONE[r.status]} className="capitalize">
                      {r.status}
                    </Badge>
                  </Td>
                  <Td className="hidden text-ink-muted sm:table-cell">{r.note ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  )
}
