import type { Metadata } from 'next'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listMyThreads } from '@/lib/messaging'
import { PageHeader } from '@/components/ui/primitives'
import { ThreadList } from '@/components/messaging/thread-list'
import { NewThreadForm } from '@/components/messaging/new-thread-form'

export const metadata: Metadata = { title: 'Messages' }

type Recipient = { user_id: string; full_name: string; role: string }

export default async function StaffMessages() {
  const ctx = await requireSchool()
  const supabase = await createClient()

  // Staff may write to colleagues and to pupils of their own school.
  const { data: members } = await supabase
    .from('memberships')
    .select('user_id, role, profile:profiles(full_name)')
    .eq('school_id', ctx.school.id)
    .eq('status', 'active')
    .returns<{ user_id: string; role: string; profile: { full_name: string } | null }[]>()

  const threads = await listMyThreads(ctx.userId)

  const recipients: Recipient[] = (members ?? [])
    .filter((m) => m.user_id !== ctx.userId)
    .map((m) => ({ user_id: m.user_id, full_name: m.profile?.full_name || 'Unnamed', role: m.role }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Messages"
        description="Conversations with colleagues and pupils. A school administrator can read any thread in the school."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <ThreadList
          threads={threads}
          basePath="/messages"
          emptyHint="Start a conversation with a colleague or a pupil."
        />
        <NewThreadForm
          basePath="/messages"
          hint="Pupils and colleagues at this school."
          recipients={recipients.map((r) => ({
            id: r.user_id,
            label: `${r.full_name} — ${r.role.replace('_', ' ')}`,
          }))}
        />
      </div>
    </div>
  )
}
