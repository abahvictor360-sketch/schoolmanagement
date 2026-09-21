'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSchool } from '@/lib/auth'
import { describeDbError, failed, parse, succeeded, type ActionResult } from '@/lib/action-result'
import { replySchema, startThreadSchema } from '@/lib/validation'

export async function startThread(input: unknown): Promise<ActionResult<{ threadId: string }>> {
  const parsed = parse(startThreadSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await requireSchool()
  const supabase = await createClient()

  // Who may write to whom is decided in the database, not here, so the rule
  // holds no matter which caller reaches it.
  const { data, error } = await supabase.rpc('start_thread', {
    p_school_id: ctx.school.id,
    p_subject: parsed.value.subject,
    p_recipient: parsed.value.recipient_id,
    p_body: parsed.value.body,
  })
  if (error) return failed(describeDbError(error))

  revalidatePath('/messages')
  revalidatePath('/portal/messages')
  return succeeded({ threadId: data as string })
}

export async function replyToThread(input: unknown): Promise<ActionResult> {
  const parsed = parse(replySchema, input)
  if (!parsed.ok) return parsed.result

  await requireSchool()
  const supabase = await createClient()
  const { error } = await supabase.rpc('post_message', {
    p_thread: parsed.value.thread_id,
    p_body: parsed.value.body,
  })
  if (error) return failed(describeDbError(error))

  revalidatePath(`/messages/${parsed.value.thread_id}`)
  revalidatePath(`/portal/messages/${parsed.value.thread_id}`)
  return succeeded()
}

export async function withdrawMessage(messageId: string, threadId: string): Promise<ActionResult> {
  await requireSchool()
  const supabase = await createClient()
  const { error } = await supabase
    .from('messages')
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('id', messageId)
  if (error) return failed(describeDbError(error))

  revalidatePath(`/messages/${threadId}`)
  revalidatePath(`/portal/messages/${threadId}`)
  return succeeded()
}

export async function markThreadRead(threadId: string): Promise<ActionResult> {
  const ctx = await requireSchool()
  const supabase = await createClient()
  await supabase
    .from('thread_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('user_id', ctx.userId)
  return succeeded()
}
