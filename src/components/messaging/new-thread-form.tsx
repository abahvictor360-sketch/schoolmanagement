'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { startThread } from '@/app/actions/messaging'
import { useAction } from '@/lib/use-action'
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui/primitives'

export function NewThreadForm({
  recipients,
  basePath,
  hint,
}: {
  recipients: { id: string; label: string }[]
  basePath: string
  hint: string
}) {
  const router = useRouter()
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const action = useAction(
    async () => startThread({ recipient_id: recipientId, subject, body }),
    {
      onSuccess: (data) => {
        const id = (data as { threadId: string } | undefined)?.threadId
        if (id) router.push(`${basePath}/${id}`)
        router.refresh()
      },
    },
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a conversation</CardTitle>
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

          <Field label="To" error={action.fieldErrors.recipient_id?.[0]} hint={hint}>
            <Select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
              <option value="">Choose…</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Subject" error={action.fieldErrors.subject?.[0]}>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>

          <Field label="Message" error={action.fieldErrors.body?.[0]}>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>

          <Button type="submit" className="w-full" disabled={action.pending}>
            {action.pending ? 'Sending…' : 'Send message'}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
