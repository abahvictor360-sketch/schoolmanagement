'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createAssessment } from '@/app/actions/assessments'
import { useAction } from '@/lib/use-action'
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input, Select } from '@/components/ui/primitives'

export function AssessmentForm({
  terms,
  levels,
  subjects,
  components,
}: {
  terms: { id: string; label: string; isCurrent: boolean }[]
  levels: { id: string; label: string }[]
  subjects: { id: string; name: string }[]
  components: { key: string; label: string; weight: number; max_score: number }[]
}) {
  const router = useRouter()
  const [termId, setTermId] = useState(terms.find((t) => t.isCurrent)?.id ?? terms[0]?.id ?? '')
  const [levelId, setLevelId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [componentKey, setComponentKey] = useState(components[0]?.key ?? '')
  const [title, setTitle] = useState('')
  const [maxScore, setMaxScore] = useState(String(components[0]?.max_score ?? 20))
  const [heldOn, setHeldOn] = useState('')

  const action = useAction(
    async () =>
      createAssessment({
        term_id: termId,
        class_level_id: levelId,
        subject_id: subjectId,
        component_key: componentKey,
        title,
        max_score: maxScore,
        held_on: heldOn,
      }),
    {
      onSuccess: (data) => {
        const id = (data as { id: string } | undefined)?.id
        if (id) router.push(`/assessments/${id}`)
        router.refresh()
      },
    },
  )

  const err = (k: string) => action.fieldErrors[k]?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set an assessment</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            action.run()
          }}
        >
          {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}

          <Field label="Term" error={err('term_id')}>
            <Select value={termId} onChange={(e) => setTermId(e.target.value)}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}{t.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Class level" error={err('class_level_id')}>
            <Select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
              <option value="">Choose…</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="Subject" error={err('subject_id')}>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Choose…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>

          <Field
            label="Component"
            error={err('component_key')}
            hint="Comes from this school's grading scheme, with its weighting."
          >
            <Select
              value={componentKey}
              onChange={(e) => {
                setComponentKey(e.target.value)
                const c = components.find((x) => x.key === e.target.value)
                if (c) setMaxScore(String(c.max_score))
              }}
            >
              {components.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} ({c.weight}%)
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Title" error={err('title')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mathematics First CA" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Marked out of" error={err('max_score')}>
              <Input type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </Field>
            <Field label="Held on" error={err('held_on')}>
              <Input type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} />
            </Field>
          </div>

          <Button type="submit" className="w-full" disabled={action.pending}>
            {action.pending ? 'Saving…' : 'Create assessment'}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
