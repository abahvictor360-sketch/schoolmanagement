import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStudent } from '@/lib/student'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, CardBody, EmptyState, PageHeader } from '@/components/ui/primitives'
import { ExamPaper } from '@/components/portal/exam-paper'
import type { CbtAttemptStatus, CbtQuestionKind } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Test' }

export default async function SitTestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStudent()
  const { id } = await params
  const supabase = await createClient()

  const { data: test } = await supabase
    .from('cbt_tests')
    .select('id, title, instructions, duration_minutes, opens_at, closes_at, subject:subjects(name)')
    .eq('id', id)
    .maybeSingle<{
      id: string
      title: string
      instructions: string | null
      duration_minutes: number
      opens_at: string
      closes_at: string
      subject: { name: string } | null
    }>()

  // RLS returns nothing for a paper that is not theirs, so this is also the
  // authorisation check.
  if (!test) notFound()

  const { data: attempt } = await supabase
    .from('cbt_attempts')
    .select('id, status, score, max_score, expires_at')
    .eq('test_id', id)
    .maybeSingle<{
      id: string
      status: CbtAttemptStatus
      score: number | null
      max_score: number | null
      expires_at: string
    }>()

  if (attempt?.status === 'submitted') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title={test.title} description={test.subject?.name ?? ''} />
        <Card>
          <CardBody className="space-y-3 text-center">
            <p className="text-sm text-ink-muted">You submitted this paper.</p>
            <p className="text-3xl font-semibold tabular-nums">
              {attempt.score} <span className="text-lg text-ink-muted">/ {attempt.max_score}</span>
            </p>
            <Link
              href="/portal/tests"
              className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium"
            >
              Back to tests
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  const now = Date.now()
  if (now < new Date(test.opens_at).getTime() || now > new Date(test.closes_at).getTime()) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title={test.title} />
        <Card>
          <EmptyState
            title="This paper is not open"
            description={`It runs from ${new Date(test.opens_at).toLocaleString()} to ${new Date(test.closes_at).toLocaleString()}.`}
          />
        </Card>
      </div>
    )
  }

  const { data: questions } = await supabase
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
    }[]>()

  const { data: saved } = attempt
    ? await supabase
        .from('cbt_answers')
        .select('question_id, option_ids')
        .eq('attempt_id', attempt.id)
        .returns<{ question_id: string; option_ids: string[] }[]>()
    : { data: [] }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={test.title}
        description={`${test.subject?.name ?? ''} · ${test.duration_minutes} minutes`}
        actions={<Badge tone="accent">{questions?.length ?? 0} questions</Badge>}
      />

      {test.instructions ? (
        <Card>
          <CardBody className="text-sm text-ink-muted">{test.instructions}</CardBody>
        </Card>
      ) : null}

      <ExamPaper
        testId={test.id}
        existingAttempt={attempt ? { id: attempt.id, expiresAt: attempt.expires_at } : null}
        questions={(questions ?? []).map((q) => ({
          ...q,
          options: [...q.options].sort((a, b) => a.ordinal - b.ordinal),
        }))}
        saved={Object.fromEntries((saved ?? []).map((a) => [a.question_id, a.option_ids]))}
      />
    </div>
  )
}
