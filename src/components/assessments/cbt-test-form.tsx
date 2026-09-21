'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createCbtTest } from '@/app/actions/cbt-authoring'
import { useAction } from '@/lib/use-action'
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui/primitives'

const isoLocal = (offsetHours: number) => {
  const d = new Date(Date.now() + offsetHours * 3600_000)
  d.setSeconds(0, 0)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function CbtTestForm({
  terms,
  levels,
  subjects,
  assessments,
}: {
  terms: { id: string; label: string; isCurrent: boolean }[]
  levels: { id: string; label: string }[]
  subjects: { id: string; name: string }[]
  assessments: { id: string; title: string }[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    term_id: terms.find((t) => t.isCurrent)?.id ?? terms[0]?.id ?? '',
    class_level_id: '',
    subject_id: '',
    assessment_id: '',
    title: '',
    instructions: '',
    duration_minutes: '30',
    opens_at: isoLocal(0),
    closes_at: isoLocal(24 * 7),
  })

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const action = useAction(async () => createCbtTest(form), {
    onSuccess: (data) => {
      const id = (data as { id: string } | undefined)?.id
      if (id) router.push(`/assessments/cbt/${id}`)
      router.refresh()
    },
  })

  const err = (k: string) => action.fieldErrors[k]?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a paper</CardTitle>
      </CardHeader>
      <CardBody>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); action.run() }}>
          {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}

          <Field label="Term" error={err('term_id')}>
            <Select value={form.term_id} onChange={(e) => set('term_id')(e.target.value)}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{t.label}{t.isCurrent ? ' (current)' : ''}</option>
              ))}
            </Select>
          </Field>

          <Field label="Class level" error={err('class_level_id')}>
            <Select value={form.class_level_id} onChange={(e) => set('class_level_id')(e.target.value)}>
              <option value="">Choose…</option>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </Select>
          </Field>

          <Field label="Subject" error={err('subject_id')}>
            <Select value={form.subject_id} onChange={(e) => set('subject_id')(e.target.value)}>
              <option value="">Choose…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>

          <Field label="Title" error={err('title')}>
            <Input value={form.title} onChange={(e) => set('title')(e.target.value)} />
          </Field>

          <Field label="Instructions" error={err('instructions')}>
            <Textarea rows={2} value={form.instructions} onChange={(e) => set('instructions')(e.target.value)} />
          </Field>

          <Field
            label="Record the score against"
            error={err('assessment_id')}
            hint="Optional. Submitting then writes a mark into the mark book."
          >
            <Select value={form.assessment_id} onChange={(e) => set('assessment_id')(e.target.value)}>
              <option value="">Do not record a mark</option>
              {assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </Select>
          </Field>

          <Field label="Minutes allowed" error={err('duration_minutes')}>
            <Input
              type="number"
              min={1}
              value={form.duration_minutes}
              onChange={(e) => set('duration_minutes')(e.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Opens" error={err('opens_at')}>
              <Input type="datetime-local" value={form.opens_at} onChange={(e) => set('opens_at')(e.target.value)} />
            </Field>
            <Field label="Closes" error={err('closes_at')}>
              <Input type="datetime-local" value={form.closes_at} onChange={(e) => set('closes_at')(e.target.value)} />
            </Field>
          </div>

          <Button type="submit" className="w-full" disabled={action.pending}>
            {action.pending ? 'Saving…' : 'Create paper'}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
