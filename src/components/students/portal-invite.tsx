'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { inviteStudentToPortal } from '@/app/actions/assessments'
import { useAction } from '@/lib/use-action'
import { Badge, Button, ErrorNote, Field, Input } from '@/components/ui/primitives'

export function PortalInvite({
  studentId,
  linked,
  invitedEmail,
}: {
  studentId: string
  linked: boolean
  invitedEmail: string | null
}) {
  const router = useRouter()
  const [email, setEmail] = useState(invitedEmail ?? '')

  const action = useAction(
    async () => inviteStudentToPortal({ student_id: studentId, email }),
    { onSuccess: () => router.refresh() },
  )

  if (linked) {
    return (
      <div className="space-y-2">
        <Badge tone="positive">Portal account active</Badge>
        <p className="text-[13px] text-ink-muted">
          This pupil can sign in and see their own attendance, results and tests.
        </p>
      </div>
    )
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        action.run()
      }}
    >
      {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
      {invitedEmail ? (
        <Badge tone="warn">Invited — waiting for {invitedEmail} to sign up</Badge>
      ) : null}

      <Field
        label="Pupil or guardian email"
        error={action.fieldErrors.email?.[0]}
        hint="They sign up with this exact address, and the account attaches to this record automatically."
      >
        <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>

      <Button type="submit" size="sm" className="w-full" disabled={action.pending}>
        {action.pending ? 'Inviting…' : invitedEmail ? 'Send a new invitation' : 'Invite to the portal'}
      </Button>
    </form>
  )
}
