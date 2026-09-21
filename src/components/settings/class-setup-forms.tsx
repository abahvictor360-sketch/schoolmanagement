'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClassArm, createClassLevel, createSubject } from '@/app/actions/setup'
import { useAction } from '@/lib/use-action'
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input, Select } from '@/components/ui/primitives'

export function ClassSetupForms({
  levels,
  nextOrdinal,
  staff,
}: {
  levels: { id: string; label: string }[]
  nextOrdinal: number
  staff: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const refresh = () => router.refresh()

  const [levelLabel, setLevelLabel] = useState('')
  const [levelOrdinal, setLevelOrdinal] = useState(String(nextOrdinal))
  const levelAction = useAction(
    async () => createClassLevel({ label: levelLabel, ordinal: levelOrdinal }),
    { onSuccess: () => { setLevelLabel(''); refresh() } },
  )

  const [armLevel, setArmLevel] = useState(levels[0]?.id ?? '')
  const [armLabel, setArmLabel] = useState('')
  const [armCapacity, setArmCapacity] = useState('')
  const [armTeacher, setArmTeacher] = useState('')
  const armAction = useAction(
    async () =>
      createClassArm({
        class_level_id: armLevel,
        label: armLabel,
        capacity: armCapacity,
        form_teacher_id: armTeacher,
      }),
    { onSuccess: () => { setArmLabel(''); refresh() } },
  )

  const [subjectName, setSubjectName] = useState('')
  const [subjectCode, setSubjectCode] = useState('')
  const [subjectCore, setSubjectCore] = useState(true)
  const subjectAction = useAction(
    async () => createSubject({ name: subjectName, code: subjectCode, is_core: subjectCore }),
    { onSuccess: () => { setSubjectName(''); setSubjectCode(''); refresh() } },
  )

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Add class level</CardTitle></CardHeader>
        <CardBody>
          <form
            className="space-y-3"
            onSubmit={(event) => { event.preventDefault(); levelAction.run() }}
          >
            {levelAction.error ? <ErrorNote>{levelAction.error}</ErrorNote> : null}
            <Field label="Label" error={levelAction.fieldErrors.label?.[0]}>
              <Input value={levelLabel} onChange={(e) => setLevelLabel(e.target.value)} placeholder="JSS 1" />
            </Field>
            <Field label="Promotion order" error={levelAction.fieldErrors.ordinal?.[0]}>
              <Input type="number" min={1} value={levelOrdinal} onChange={(e) => setLevelOrdinal(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" disabled={levelAction.pending}>
              {levelAction.pending ? 'Saving…' : 'Add level'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add class arm</CardTitle></CardHeader>
        <CardBody>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); armAction.run() }}>
            {armAction.error ? <ErrorNote>{armAction.error}</ErrorNote> : null}
            <Field label="Class level" error={armAction.fieldErrors.class_level_id?.[0]}>
              <Select value={armLevel} onChange={(e) => setArmLevel(e.target.value)}>
                <option value="">Choose…</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Arm label" error={armAction.fieldErrors.label?.[0]}>
              <Input value={armLabel} onChange={(e) => setArmLabel(e.target.value)} placeholder="A" />
            </Field>
            <Field label="Capacity" error={armAction.fieldErrors.capacity?.[0]}>
              <Input type="number" min={1} value={armCapacity} onChange={(e) => setArmCapacity(e.target.value)} />
            </Field>
            <Field label="Form teacher">
              <Select value={armTeacher} onChange={(e) => setArmTeacher(e.target.value)}>
                <option value="">Not assigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </Select>
            </Field>
            <Button type="submit" className="w-full" disabled={armAction.pending}>
              {armAction.pending ? 'Saving…' : 'Add arm'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add subject</CardTitle></CardHeader>
        <CardBody>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); subjectAction.run() }}>
            {subjectAction.error ? <ErrorNote>{subjectAction.error}</ErrorNote> : null}
            <Field label="Name" error={subjectAction.fieldErrors.name?.[0]}>
              <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
            </Field>
            <Field label="Code" error={subjectAction.fieldErrors.code?.[0]}>
              <Input value={subjectCode} onChange={(e) => setSubjectCode(e.target.value.toUpperCase())} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={subjectCore} onChange={(e) => setSubjectCore(e.target.checked)} />
              Core subject
            </label>
            <Button type="submit" className="w-full" disabled={subjectAction.pending}>
              {subjectAction.pending ? 'Saving…' : 'Add subject'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
