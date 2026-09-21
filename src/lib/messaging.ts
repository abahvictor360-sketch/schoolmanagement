import { createClient } from '@/lib/supabase/server'

export type ThreadSummary = {
  id: string
  subject: string
  lastMessageAt: string
  unread: boolean
  others: string[]
}

/** Threads the caller takes part in, newest first. RLS does the filtering. */
export async function listMyThreads(userId: string): Promise<ThreadSummary[]> {
  const supabase = await createClient()

  const { data: mine } = await supabase
    .from('thread_participants')
    .select('thread_id, last_read_at')
    .eq('user_id', userId)
    .returns<{ thread_id: string; last_read_at: string | null }[]>()

  const ids = (mine ?? []).map((m) => m.thread_id)
  if (ids.length === 0) return []

  const [{ data: threads }, { data: participants }] = await Promise.all([
    supabase
      .from('message_threads')
      .select('id, subject, last_message_at')
      .in('id', ids)
      .order('last_message_at', { ascending: false })
      .returns<{ id: string; subject: string; last_message_at: string }[]>(),
    supabase
      .from('thread_participants')
      .select('thread_id, user_id, profile:profiles(full_name)')
      .in('thread_id', ids)
      .returns<{ thread_id: string; user_id: string; profile: { full_name: string } | null }[]>(),
  ])

  const readAt = new Map((mine ?? []).map((m) => [m.thread_id, m.last_read_at]))

  return (threads ?? []).map((t) => ({
    id: t.id,
    subject: t.subject,
    lastMessageAt: t.last_message_at,
    unread: (() => {
      const seen = readAt.get(t.id)
      return !seen || new Date(t.last_message_at) > new Date(seen)
    })(),
    others: (participants ?? [])
      .filter((p) => p.thread_id === t.id && p.user_id !== userId)
      .map((p) => p.profile?.full_name || 'Unknown'),
  }))
}

export type ThreadMessage = {
  id: string
  body: string
  createdAt: string
  senderId: string | null
  senderName: string
  withdrawn: boolean
  mine: boolean
}

export async function loadThread(threadId: string, userId: string) {
  const supabase = await createClient()

  const { data: thread } = await supabase
    .from('message_threads')
    .select('id, subject')
    .eq('id', threadId)
    .maybeSingle<{ id: string; subject: string }>()

  if (!thread) return null

  const [{ data: messages }, { data: participants }] = await Promise.all([
    supabase
      .from('messages')
      .select('id, body, created_at, sender_id, withdrawn_at, sender:profiles(full_name)')
      .eq('thread_id', threadId)
      .order('created_at')
      .returns<{
        id: string
        body: string
        created_at: string
        sender_id: string | null
        withdrawn_at: string | null
        sender: { full_name: string } | null
      }[]>(),
    supabase
      .from('thread_participants')
      .select('user_id, profile:profiles(full_name)')
      .eq('thread_id', threadId)
      .returns<{ user_id: string; profile: { full_name: string } | null }[]>(),
  ])

  return {
    thread,
    others: (participants ?? [])
      .filter((p) => p.user_id !== userId)
      .map((p) => p.profile?.full_name || 'Unknown'),
    messages: (messages ?? []).map<ThreadMessage>((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      senderId: m.sender_id,
      senderName: m.sender?.full_name || 'Unknown',
      withdrawn: m.withdrawn_at !== null,
      mine: m.sender_id === userId,
    })),
  }
}

/**
 * How many of the caller's threads have arrived since they last read them.
 * One row per thread the caller participates in; RLS restricts it to theirs,
 * so there is no school_id filter to forget here.
 */
export async function countUnreadThreads(userId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('thread_participants')
    .select('last_read_at, thread:message_threads!inner(last_message_at)')
    .eq('user_id', userId)
    .returns<{ last_read_at: string | null; thread: { last_message_at: string } | null }[]>()

  return (data ?? []).filter(
    (row) =>
      row.thread !== null &&
      (row.last_read_at === null ||
        new Date(row.thread.last_message_at) > new Date(row.last_read_at)),
  ).length
}
