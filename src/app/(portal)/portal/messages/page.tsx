import type { Metadata } from 'next'
import { requireStudent } from '@/lib/student'
import { createClient } from '@/lib/supabase/server'
import { listMyThreads } from '@/lib/messaging'
import { PageHeader } from '@/components/ui/primitives'
import { ThreadList } from '@/components/messaging/thread-list'
import { NewThreadForm } from '@/components/messaging/new-thread-form'

export const metadata: Metadata = { title: 'Messages' }

export default async function PortalMessages() {
  const ctx = await requireStudent()
  const supabase = await createClient()

  const [threads, { data: staff }] = await Promise.all([
    listMyThreads(ctx.userId),
    supabase.rpc('messageable_staff', { p_school_id: ctx.school.id }),
  ])

  return (
    <div className="space-y-4">
      <PageHeader title="Messages" description="You can write to staff at your school." />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <ThreadList
          threads={threads}
          basePath="/portal/messages"
          emptyHint="Write to a teacher if you need help with your work."
        />
        <NewThreadForm
          basePath="/portal/messages"
          hint="Only staff at your school appear here."
          recipients={(staff ?? []).map((s) => ({
            id: s.user_id,
            label: s.designation ? `${s.full_name} — ${s.designation}` : s.full_name,
          }))}
        />
      </div>
    </div>
  )
}
