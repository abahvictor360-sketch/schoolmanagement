import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStudent } from '@/lib/student'
import { loadThread } from '@/lib/messaging'
import { markThreadRead } from '@/app/actions/messaging'
import { PageHeader } from '@/components/ui/primitives'
import { ThreadView } from '@/components/messaging/thread-view'

export const metadata: Metadata = { title: 'Conversation' }

export default async function PortalThread({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStudent()
  const { id } = await params

  const loaded = await loadThread(id, ctx.userId)
  if (!loaded) notFound()
  await markThreadRead(id)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={loaded.thread.subject}
        description={`With ${loaded.others.join(', ')}`}
        actions={
          <Link
            href="/portal/messages"
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
          >
            All messages
          </Link>
        }
      />
      <ThreadView threadId={id} messages={loaded.messages} />
    </div>
  )
}
