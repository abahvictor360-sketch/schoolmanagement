import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, CardHeader, CardTitle, DataTable, EmptyState, PageHeader, Td, Th } from '@/components/ui/primitives'
import { QuestionEditor } from '@/components/assessments/question-editor'
import type { AssessmentStatus, CbtAttemptStatus, CbtQuestionKind } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Edit paper' }

export default async function CbtEditPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSchool()
  const { id } = await params
  const supabase = await createClient()

  const { data: test } = await supabase
    .from('cbt_tests')
    .select(
      'id, title, status, duration_minutes, opens_at, closes_at, subject:subjects(name), class_level:class_levels(label)',
    )
    .eq('id', id)
    .eq('school_id', ctx.school.id)
    .maybeSingle<{
      id: string
      title: string
      status: AssessmentStatus
      duration_minutes: number
      opens_at: string
      closes_at: string
      subject: { name: string } | null
      class_level: { label: string } | null
    }>()

  if (!test) notFound()

  const [{ data: questions }, { data: attempts }] = await Promise.all([
    supabase
      .from('cbt_questions')
      .select('id, ordinal, prompt, kind, marks, options:cbt_options(id, ordinal, label)')
      .eq('test_id', id)
      .order('ordinal')
      .returns<{
        id: string
        ordinal: number
        prompt: string
        kind: CbtQuestionKind
        marks: number
        options: { id: string; ordinal: number; label: string }[]
      }[]>(),
    supabase
      .from('cbt_attempts')
      .select('id, status, score, max_score, student:enrollments(student:students(first_name, last_name))')
      .eq('test_id', id)
      .returns<{
        id: string
        status: CbtAttemptStatus
        score: number | null
        max_score: number | null
        student: { student: { first_name: string; last_name: string } | null } | null
      }[]>(),
  ])

  // Staff can read the key, and it is shown here so a teacher can check the
  // paper before publishing it.
  const { data: keys } = await supabase
    .from('cbt_answer_keys')
    .select('question_id, option_ids')
    .in('question_id', (questions ?? []).map((q) => q.id))
    .returns<{ question_id: string; option_ids: string[] }[]>()

  const keyFor = new Map((keys ?? []).map((k) => [k.question_id, k.option_ids]))

  return (
    <div className="space-y-4">
      <PageHeader
        title={test.title}
        description={`${test.subject?.name} · ${test.class_level?.label} · ${test.duration_minutes} minutes`}
        actions={
          <Link
            href="/assessments/cbt"
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
          >
            All papers
          </Link>
        }
      />

      <QuestionEditor
        testId={test.id}
        status={test.status}
        questions={(questions ?? []).map((q) => ({
          ...q,
          options: [...q.options].sort((a, b) => a.ordinal - b.ordinal),
          correctIds: keyFor.get(q.id) ?? [],
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Attempts</CardTitle>
          <Badge>{attempts?.length ?? 0}</Badge>
        </CardHeader>
        {attempts && attempts.length > 0 ? (
          <DataTable className="min-w-0">
            <thead>
              <tr>
                <Th>Pupil</Th>
                <Th>Status</Th>
                <Th className="text-right">Score</Th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <Td>
                    {a.student?.student
                      ? `${a.student.student.last_name} ${a.student.student.first_name}`
                      : 'Unknown'}
                  </Td>
                  <Td>
                    <Badge tone={a.status === 'submitted' ? 'positive' : 'warn'} className="capitalize">
                      {a.status.replace('_', ' ')}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {a.status === 'submitted' ? `${a.score} / ${a.max_score}` : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyState title="Nobody has sat this yet" description="Attempts appear here as pupils submit." />
        )}
      </Card>
    </div>
  )
}
