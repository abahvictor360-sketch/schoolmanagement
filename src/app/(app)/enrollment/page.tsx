import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listArms, listTerms } from '@/lib/queries'
import { Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui/primitives'
import { EnrollmentBoard } from '@/components/enrollment/board'

export const metadata: Metadata = { title: 'Enrollment' }

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; arm?: string }>
}) {
  const ctx = await requireRole('school_admin')
  const { term, arm } = await searchParams
  const [terms, arms] = await Promise.all([listTerms(ctx.school.id), listArms(ctx.school.id)])

  const activeTerm = terms.find((t) => t.id === term) ?? terms.find((t) => t.is_current) ?? terms[0]
  const activeArm = arms.find((a) => a.id === arm) ?? arms[0]

  if (!activeTerm || !activeArm) {
    return (
      <div className="space-y-4">
        <PageHeader title="Enrollment" />
        <Card>
          <EmptyState
            title="Set up the academic year first"
            description="Enrollment needs at least one term and one class arm."
            action={
              <Link
                href="/settings/classes"
                className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white"
              >
                Go to class setup
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const supabase = await createClient()

  const [{ data: roster }, { data: unassigned }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, status, student:students(id, admission_number, first_name, last_name)')
      .eq('school_id', ctx.school.id)
      .eq('term_id', activeTerm.id)
      .eq('class_arm_id', activeArm.id)
      .returns<
        { id: string; status: string; student: { id: string; admission_number: string; first_name: string; last_name: string } | null }[]
      >(),
    supabase
      .from('students')
      .select('id, admission_number, first_name, last_name')
      .eq('school_id', ctx.school.id)
      .eq('status', 'active')
      .order('last_name')
      .limit(1000),
  ])

  const enrolledIds = new Set((roster ?? []).map((r) => r.student?.id))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Enrollment"
        description="A student belongs to a class arm through their enrollment for a term, never directly."
        actions={
          <Link
            href="/enrollment/rollover"
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
          >
            End-of-term rollover
          </Link>
        }
      />

      <EnrollmentBoard
        terms={terms}
        arms={arms}
        activeTermId={activeTerm.id}
        activeArmId={activeArm.id}
        roster={(roster ?? []).flatMap((r) =>
          r.student
            ? [{
                enrollmentId: r.id,
                status: r.status,
                id: r.student.id,
                name: `${r.student.last_name} ${r.student.first_name}`,
                admissionNumber: r.student.admission_number,
              }]
            : [],
        )}
        candidates={(unassigned ?? [])
          .filter((s) => !enrolledIds.has(s.id))
          .map((s) => ({
            id: s.id,
            name: `${s.last_name} ${s.first_name}`,
            admissionNumber: s.admission_number,
          }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>How rollover works</CardTitle>
        </CardHeader>
        <CardBody className="text-sm text-ink-muted">
          Rolling a term over writes fresh enrollment rows in the next term and marks the closed
          term&rsquo;s rows as promoted. Nothing is deleted, so last term&rsquo;s roster and
          attendance stay exactly as they were.
        </CardBody>
      </Card>
    </div>
  )
}
