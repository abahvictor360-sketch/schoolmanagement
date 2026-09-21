'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { inviteMember } from '@/app/actions/setup'
import { useAction } from '@/lib/use-action'
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input, Select } from '@/components/ui/primitives'

export function InviteForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'school_admin' | 'teacher'>('teacher')

  const action = useAction(async () => inviteMember({ email, role }), {
    onSuccess: () => {
      setEmail('')
      router.refresh()
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite someone</CardTitle>
      </CardHeader>
      <CardBody>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); action.run() }}>
          {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
          <Field label="Email" error={action.fieldErrors.email?.[0]}>
            <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value as 'school_admin' | 'teacher')}>
              <option value="teacher">Teacher</option>
              <option value="school_admin">School administrator</option>
            </Select>
          </Field>
          <Button type="submit" className="w-full" disabled={action.pending}>
            {action.pending ? 'Inviting…' : 'Send invitation'}
          </Button>
          <p className="text-[13px] text-ink-muted">
            They join by creating an account with this exact address. Their access appears the
            moment they sign up.
          </p>
        </form>
      </CardBody>
    </Card>
  )
}
