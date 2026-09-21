import type { Metadata } from 'next'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listArms, listTerms } from '@/lib/queries'
import {
  Badge, Card, CardHeader, CardTitle, DataTable, EmptyState, PageHeader, Td, Th,
} from '@/components/ui/primitives'
import { PrintButton } from '@/components/print-button'
import { TermPicker } from '@/components/attendance/term-picker'
import type { AttendanceStatus } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Attendance summary' }

type Entry = {
  status: AttendanceStatus
  enrollment: {
    id: string
    class_arm_id: string
    student: { id: string; first_name: string; last_name: string; admission_number: string } | null
  } | null
}

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>
}) {
  const ctx = await requireSchool()
  const { term } = await searchParams
  const [terms, arms] = await Promise.all([listTerms(ctx.school.id), listArms(ctx.school.id)])
  const activeTerm = terms.find((t) => t.id === term) ?? terms.find((t) => t.is_current) ?? terms[0]

  if (!activeTerm) {
    return (
      <div className="space-y-4">
        <PageHeader title="Attendance summary" />
        <Card>
          <EmptyState title="No terms yet" description="Create a term before looking at summaries." />
        </Card>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: entries } = await supabase
    .from('attendance_entries')
    .select(
      'status, enrollment:enrollments!inner(id, class_arm_id, term_id, student:students(id, first_name, last_name, admission_number))',
    )
    .eq('school_id', ctx.school.id)
    .eq('enrollment.term_id', activeTerm.id)
    .limit(50000)
    .returns<Entry[]>()

  const perStudent = new Map<
    string,
    { name: string; admissionNumber: string; armId: string; present: number; absent: number; late: number; excused: number }
  >()

  for (const entry of entries ?? []) {
    const enrollment = entry.enrollment
    if (!enrollment?.student) continue
    const key = enrollment.id
    const row = perStudent.get(key) ?? {
      name: `${enrollment.student.last_name} ${enrollment.student.first_name}`,
      admissionNumber: enrollment.student.admission_number,
      armId: enrollment.class_arm_id,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    }
    row[entry.status] += 1
    perStudent.set(key, row)
  }

  const rows = [...perStudent.values()].sort((a, b) => a.name.localeCompare(b.name))
  const armLabel = (id: string) => arms.find((a) => a.id === id)?.full_label ?? '—'

  const totals = rows.reduce(
    (sum, r) => ({
      present: sum.present + r.present,
      absent: sum.absent + r.absent,
      late: sum.late + r.late,
      excused: sum.excused + r.excused,
    }),
    { present: 0, absent: 0, late: 0, excused: 0 },
  )
  const marked = totals.present + totals.absent + totals.late + totals.excused
  const rate = marked === 0 ? 0 : Math.round(((totals.present + totals.late) / marked) * 100)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance summary"
        description={`${activeTerm.session_label} · ${activeTerm.label}`}
        actions={<PrintButton label="Print summary" />}
      />

      <TermPicker terms={terms} active={activeTerm.id} />

      <Card>
        <CardHeader>
          <CardTitle>Per student</CardTitle>
          <Badge tone={rate >= 85 ? 'positive' : rate >= 70 ? 'warn' : 'danger'}>
            {rate}% attendance across {marked} marks
          </Badge>
        </CardHeader>

        {rows.length === 0 ? (
          <EmptyState
            title="No attendance recorded yet"
            description="Summaries appear once registers have been taken for this term."
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th className="hidden sm:table-cell">Class arm</Th>
                <Th className="text-right">Present</Th>
                <Th className="text-right">Absent</Th>
                <Th className="text-right">Late</Th>
                <Th className="text-right">Excused</Th>
                <Th className="text-right">Rate</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const total = r.present + r.absent + r.late + r.excused
                const pct = total === 0 ? 0 : Math.round(((r.present + r.late) / total) * 100)
                return (
                  <tr key={r.admissionNumber}>
                    <Td>
                      <span className="block font-medium">{r.name}</span>
                      <span className="font-mono text-[12px] text-ink-muted">{r.admissionNumber}</span>
                    </Td>
                    <Td className="hidden sm:table-cell">{armLabel(r.armId)}</Td>
                    <Td className="text-right tabular-nums">{r.present}</Td>
                    <Td className="text-right tabular-nums">{r.absent}</Td>
                    <Td className="text-right tabular-nums">{r.late}</Td>
                    <Td className="text-right tabular-nums">{r.excused}</Td>
                    <Td className="text-right font-medium tabular-nums">{pct}%</Td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  )
}
