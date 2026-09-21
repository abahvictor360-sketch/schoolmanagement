import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives'
import { MarkSheet } from '@/components/assessments/mark-sheet'
import { PrintButton } from '@/components/print-button'
import type { AssessmentStatus } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Enter marks' }

export default async function MarkSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSchool()
  const { id } = await params
  const supabase = await createClient()

  const { data: assessment } = await supabase
    .from('assessments')
    .select(
      'id, title, component_key, max_score, status, term_id, class_level_id, subject:subjects(name), class_level:class_levels(label), term:terms(label)',
    )
    .eq('id', id)
    .eq('school_id', ctx.school.id)
    .maybeSingle<{
      id: string
      title: string
      component_key: string
      max_score: number
      status: AssessmentStatus
      term_id: string
      class_level_id: string
      subject: { name: string } | null
      class_level: { label: string } | null
      term: { label: string } | null
    }>()

  if (!assessment) notFound()

  // Everyone enrolled in that class level, for that term.
  const [{ data: roster }, { data: scores }] = await Promise.all([
    supabase
      .from('enrollments')
      .select(
        'id, student:students(admission_number, first_name, last_name), class_arm:class_arms!inner(label, class_level_id, class_level:class_levels(label))',
      )
      .eq('school_id', ctx.school.id)
      .eq('term_id', assessment.term_id)
      .eq('status', 'active')
      .eq('class_arm.class_level_id', assessment.class_level_id)
      .returns<{
        id: string
        student: { admission_number: string; first_name: string; last_name: string } | null
        class_arm: { label: string; class_level_id: string; class_level: { label: string } } | null
      }[]>(),
    supabase
      .from('assessment_scores')
      .select('enrollment_id, score')
      .eq('assessment_id', id)
      .returns<{ enrollment_id: string; score: number }[]>(),
  ])

  const existing = Object.fromEntries((scores ?? []).map((s) => [s.enrollment_id, String(s.score)]))

  const pupils = (roster ?? [])
    .flatMap((r) =>
      r.student
        ? [{
            enrollmentId: r.id,
            name: `${r.student.last_name} ${r.student.first_name}`,
            admissionNumber: r.student.admission_number,
            arm: r.class_arm ? `${r.class_arm.class_level.label} ${r.class_arm.label}` : '',
          }]
        : [],
    )
    .sort((a, b) => a.arm.localeCompare(b.arm) || a.name.localeCompare(b.name))

  const componentLabel =
    ctx.config.assessment_components.find((c) => c.key === assessment.component_key)?.label ??
    assessment.component_key

  return (
    <div className="space-y-4">
      <PageHeader
        title={assessment.title}
        description={`${assessment.subject?.name} · ${assessment.class_level?.label} · ${assessment.term?.label} · ${componentLabel}, marked out of ${assessment.max_score}`}
        actions={
          <>
            <Badge tone={assessment.status === 'published' ? 'positive' : 'neutral'} className="capitalize">
              {assessment.status}
            </Badge>
            <PrintButton />
            <Link
              href="/assessments"
              className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
            >
              Back
            </Link>
          </>
        }
      />

      {pupils.length === 0 ? (
        <Card>
          <EmptyState
            title="Nobody is enrolled at this class level"
            description="Enroll pupils into an arm of this level for the chosen term, then come back."
          />
        </Card>
      ) : (
        <MarkSheet
          assessmentId={assessment.id}
          maxScore={Number(assessment.max_score)}
          status={assessment.status}
          pupils={pupils}
          existing={existing}
        />
      )}
    </div>
  )
}
