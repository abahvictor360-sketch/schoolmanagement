'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { replyToThread, withdrawMessage } from '@/app/actions/messaging'
import { useAction } from '@/lib/use-action'
import { cn } from '@/lib/utils'
import type { ThreadMessage } from '@/lib/messaging'
import { Button, Card, CardBody, ErrorNote, Textarea } from '@/components/ui/primitives'

export function ThreadView({
  threadId,
  messages,
}: {
  threadId: string
  messages: ThreadMessage[]
}) {
  const router = useRouter()
  const [body, setBody] = useState('')

  const reply = useAction(async () => replyToThread({ thread_id: threadId, body }), {
    onSuccess: () => {
      setBody('')
      router.refresh()
    },
  })

  const withdraw = useAction(async (id: string) => withdrawMessage(id, threadId), {
    onSuccess: () => router.refresh(),
  })

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-[14px] border px-3 py-2 sm:max-w-[70%]',
                m.mine ? 'border-accent/30 bg-accent-soft' : 'border-line bg-surface',
              )}
            >
              <p className="text-[12px] font-medium text-ink-muted">
                {m.mine ? 'You' : m.senderName}
                <span className="ml-2 font-normal">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </p>
              {m.withdrawn ? (
                <p className="mt-1 text-sm text-ink-muted italic">
                  This message was withdrawn by its sender.
                </p>
              ) : (
                <p className="mt-1 text-sm whitespace-pre-wrap break-words">{m.body}</p>
              )}
              {m.mine && !m.withdrawn ? (
                <button
                  type="button"
                  disabled={withdraw.pending}
                  onClick={() => withdraw.run(m.id)}
                  className="no-print mt-1 text-[11px] text-ink-muted underline-offset-2 hover:underline"
                >
                  Withdraw
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {withdraw.error ? <ErrorNote>{withdraw.error}</ErrorNote> : null}

      <Card className="no-print">
        <CardBody className="space-y-3">
          {reply.error ? <ErrorNote>{reply.error}</ErrorNote> : null}
          <label>
            <span className="sr-only">Your reply</span>
            <Textarea
              rows={3}
              value={body}
              placeholder="Write a reply…"
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <Button
            disabled={reply.pending || body.trim().length === 0}
            onClick={() => reply.run()}
          >
            {reply.pending ? 'Sending…' : 'Send'}
          </Button>
          <p className="text-[12px] text-ink-muted">
            A sent message cannot be edited. You can withdraw your own message, but the school
            keeps a record of it.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
