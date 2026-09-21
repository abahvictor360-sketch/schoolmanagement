'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createGuardian, linkGuardian } from '@/app/actions/people'
import { useAction } from '@/lib/use-action'
import { Button, ErrorNote, Field, Input, Select } from '@/components/ui/primitives'

export function GuardianLinker({
  studentId,
  guardians,
}: {
  studentId: string
  guardians: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'existing' | 'new'>(guardians.length ? 'existing' : 'new')
  const [guardianId, setGuardianId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [relationship, setRelationship] = useState('Parent')
  const [isPrimary, setIsPrimary] = useState(false)

  const action = useAction(
    async () => {
      let id = guardianId
      if (mode === 'new') {
        const created = await createGuardian({ full_name: name, phone })
        if (!created.ok) return created
        id = (created.data as { id: string }).id
      }
      if (!id) return { ok: false as const, error: 'Choose a guardian first.' }
      return linkGuardian({ student_id: studentId, guardian_id: id, relationship, is_primary: isPrimary })
    },
    {
      onSuccess: () => {
        setName('')
        setPhone('')
        setGuardianId('')
        router.refresh()
      },
    },
  )

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        action.run()
      }}
    >
      <p className="text-[13px] font-medium">Link a guardian</p>
      {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}

      <div className="flex gap-2 text-[13px]">
        {(['existing', 'new'] as const).map((value) => (
          <label key={value} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="guardian-mode"
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {value === 'existing' ? 'Existing guardian' : 'New guardian'}
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {mode === 'existing' ? (
          <Field label="Guardian" className="sm:col-span-2">
            <Select value={guardianId} onChange={(event) => setGuardianId(event.target.value)}>
              <option value="">Choose…</option>
              {guardians.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.full_name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
            <Field label="Full name">
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Phone">
              <Input value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} />
            </Field>
          </>
        )}

        <Field label="Relationship">
          <Input value={relationship} onChange={(event) => setRelationship(event.target.value)} />
        </Field>

        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Primary contact
        </label>
      </div>

      <Button type="submit" size="sm" disabled={action.pending}>
        {action.pending ? 'Linking…' : 'Link guardian'}
      </Button>
    </form>
  )
}
