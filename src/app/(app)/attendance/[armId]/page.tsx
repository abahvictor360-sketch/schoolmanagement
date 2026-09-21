import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listArms, listTerms } from '@/lib/queries'
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives'
import { RegisterSheet } from '@/components/attendance/register-sheet'
import type { AttendanceStatus } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Take register' }

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ armId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const ctx = await requireSchool()
  const { armId } = await params
  const { date } = await searchParams
  const registerDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '')
    ? date!
    : new Date().toISOString().slice(0, 10)

  const [arms, terms] = await Promise.all([listArms(ctx.school.id), listTerms(ctx.school.id)])
  const arm = arms.find((a) => a.id === armId)
  if (!arm) notFound()

  const term = terms.find((t) => t.is_current)
  if (!term) {
    return (
      <div className="space-y-4">
        <PageHeader title={arm.full_label} />
        <Card>
          <EmptyState title="No current term" description="Set a current term in Settings first." />
        </Card>
      </div>
    )
  }

  const supabase = await createClient()

  const [{ data: roster }, { data: register }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, student:students(id, admission_number, first_name, last_name)')
      .eq('school_id', ctx.school.id)
      .eq('term_id', term.id)
      .eq('class_arm_id', arm.id)
      .eq('status', 'active')
      .returns<
        { id: string; student: { id: string; admission_number: string; first_name: string; last_name: string } | null }[]
      >(),
    supabase
      .from('attendance_registers')
      .select('id, taken_at, attendance_entries(enrollment_id, status, note)')
      .eq('school_id', ctx.school.id)
      .eq('class_arm_id', arm.id)
      .eq('register_date', registerDate)
      .maybeSingle<{
        id: string
        taken_at: string
        attendance_entries: { enrollment_id: string; status: AttendanceStatus; note: string | null }[]
      }>(),
  ])

  const existing = new Map(
    (register?.attendance_entries ?? []).map((e) => [e.enrollment_id, e]),
  )

  const pupils = (roster ?? [])
    .flatMap((r) =>
      r.student
        ? [{
            enrollmentId: r.id,
            name: `${r.student.last_name} ${r.student.first_name}`,
            admissionNumber: r.student.admission_number,
            status: existing.get(r.id)?.status ?? ('present' as AttendanceStatus),
            note: existing.get(r.id)?.note ?? '',
          }]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={arm.full_label}
        description={`${term.session_label} · ${term.label}`}
      />

      {pupils.length === 0 ? (
        <Card>
          <EmptyState
            title="Nobody is enrolled in this arm"
            description="Enroll students into this class arm for the current term first."
          />
        </Card>
      ) : (
        <RegisterSheet
          armId={arm.id}
          armLabel={arm.full_label}
          termId={term.id}
          date={registerDate}
          pupils={pupils}
          alreadyTakenAt={register?.taken_at ?? null}
        />
      )}
    </div>
  )
}
