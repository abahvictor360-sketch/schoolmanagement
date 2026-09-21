'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addQuestion, deleteQuestion, setCbtStatus } from '@/app/actions/cbt-authoring'
import { useAction } from '@/lib/use-action'
import { cn } from '@/lib/utils'
import type { AssessmentStatus, CbtQuestionKind } from '@/lib/database.types'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorNote, Field, Input, Select, Textarea,
} from '@/components/ui/primitives'

type Question = {
  id: string
  ordinal: number
  prompt: string
  kind: CbtQuestionKind
  marks: number
  options: { id: string; ordinal: number; label: string }[]
  correctIds: string[]
}

export function QuestionEditor({
  testId,
  status,
  questions,
}: {
  testId: string
  status: AssessmentStatus
  questions: Question[]
}) {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [kind, setKind] = useState<CbtQuestionKind>('single_choice')
  const [marks, setMarks] = useState('1')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState<number[]>([])

  const add = useAction(
    async () =>
      addQuestion({
        test_id: testId,
        prompt,
        kind,
        marks,
        options: kind === 'true_false' ? ['True', 'False'] : options.filter((o) => o.trim()),
        correct,
      }),
    {
      onSuccess: () => {
        setPrompt('')
        setOptions(['', '', '', ''])
        setCorrect([])
        router.refresh()
      },
    },
  )

  const remove = useAction(async (id: string) => deleteQuestion(id, testId), {
    onSuccess: () => router.refresh(),
  })

  const publish = useAction(
    async () => setCbtStatus(testId, status === 'published' ? 'draft' : 'published'),
    { onSuccess: () => router.refresh() },
  )

  const visibleOptions = kind === 'true_false' ? ['True', 'False'] : options

  function toggleCorrect(index: number) {
    setCorrect((current) =>
      kind === 'multi_choice'
        ? current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index]
        : [index],
    )
  }

  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0)

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <div className="flex items-center gap-2">
            <Badge>{questions.length} · {totalMarks} marks</Badge>
            <Badge tone={status === 'published' ? 'positive' : 'neutral'} className="capitalize">
              {status}
            </Badge>
          </div>
        </CardHeader>

        {questions.length === 0 ? (
          <EmptyState title="No questions yet" description="Add the first one on the right." />
        ) : (
          <CardBody className="space-y-3">
            {remove.error ? <ErrorNote>{remove.error}</ErrorNote> : null}
            <ol className="space-y-3">
              {questions.map((q) => (
                <li key={q.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">
                      <span className="text-ink-muted">{q.ordinal}.</span> {q.prompt}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge>{q.marks}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={remove.pending}
                        onClick={() => remove.run(q.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {q.options.map((o) => {
                      const right = q.correctIds.includes(o.id)
                      return (
                        <li
                          key={o.id}
                          className={cn(
                            'flex items-center gap-2 rounded px-2 py-1 text-[13px]',
                            right ? 'bg-emerald-50 font-medium text-positive' : 'text-ink-muted',
                          )}
                        >
                          <span aria-hidden>{right ? '✓' : '·'}</span>
                          {o.label}
                          {right ? <span className="sr-only">(correct answer)</span> : null}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </CardBody>
        )}

        <CardBody className="flex flex-wrap items-center gap-2 border-t border-line">
          {publish.error ? <ErrorNote>{publish.error}</ErrorNote> : null}
          <Button disabled={publish.pending} onClick={() => publish.run()}>
            {publish.pending
              ? 'Working…'
              : status === 'published'
                ? 'Unpublish'
                : 'Publish to pupils'}
          </Button>
          <p className="text-[13px] text-ink-muted">
            Pupils never see the answer key: it lives in a table they have no permission to read.
          </p>
        </CardBody>
      </Card>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>Add a question</CardTitle>
        </CardHeader>
        <CardBody>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.run() }}>
            {add.error ? <ErrorNote>{add.error}</ErrorNote> : null}

            <Field label="Question" error={add.fieldErrors.prompt?.[0]}>
              <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <Select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as CbtQuestionKind)
                    setCorrect([])
                  }}
                >
                  <option value="single_choice">One answer</option>
                  <option value="multi_choice">Several answers</option>
                  <option value="true_false">True or false</option>
                </Select>
              </Field>
              <Field label="Marks" error={add.fieldErrors.marks?.[0]}>
                <Input type="number" min={1} value={marks} onChange={(e) => setMarks(e.target.value)} />
              </Field>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-[13px] font-medium">
                Options{' '}
                <span className="font-normal text-ink-muted">
                  — tick the {kind === 'multi_choice' ? 'correct answers' : 'correct answer'}
                </span>
              </legend>
              {add.fieldErrors.correct?.[0] ? (
                <p role="alert" className="text-xs text-danger">{add.fieldErrors.correct[0]}</p>
              ) : null}
              {visibleOptions.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type={kind === 'multi_choice' ? 'checkbox' : 'radio'}
                    name="correct-option"
                    checked={correct.includes(index)}
                    onChange={() => toggleCorrect(index)}
                    aria-label={`Option ${index + 1} is correct`}
                    className="size-4 shrink-0"
                  />
                  <Input
                    value={value}
                    disabled={kind === 'true_false'}
                    aria-label={`Option ${index + 1}`}
                    onChange={(e) =>
                      setOptions((current) => current.map((o, i) => (i === index ? e.target.value : o)))
                    }
                  />
                </div>
              ))}
              {kind !== 'true_false' && options.length < 8 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOptions((o) => [...o, ''])}
                >
                  Add an option
                </Button>
              ) : null}
            </fieldset>

            <Button type="submit" className="w-full" disabled={add.pending}>
              {add.pending ? 'Adding…' : 'Add question'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
