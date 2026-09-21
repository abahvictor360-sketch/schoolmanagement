'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSchool } from '@/lib/auth'
import { describeDbError, failed, parse, succeeded, type ActionResult } from '@/lib/action-result'
import { cbtAnswersSchema } from '@/lib/validation'

export async function startAttempt(testId: string): Promise<ActionResult<{ attemptId: string }>> {
  await requireSchool()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_cbt_attempt', { p_test: testId })
  if (error) return failed(describeDbError(error))
  return succeeded({ attemptId: data as string })
}

/**
 * Autosave. The server is the only clock, so a save after the deadline is
 * refused there rather than being trusted from the browser.
 */
export async function saveAnswers(input: unknown): Promise<ActionResult<{ saved: number }>> {
  const parsed = parse(cbtAnswersSchema, input)
  if (!parsed.ok) return parsed.result

  await requireSchool()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_cbt_answers', {
    p_attempt: parsed.value.attempt_id,
    p_answers: parsed.value.answers,
  })
  if (error) return failed(describeDbError(error))
  return succeeded({ saved: data ?? 0 })
}

export async function submitAttempt(
  input: unknown,
): Promise<ActionResult<{ score: number; max_score: number; late: boolean }>> {
  const parsed = parse(cbtAnswersSchema, input)
  if (!parsed.ok) return parsed.result

  await requireSchool()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('submit_cbt_attempt', {
    p_attempt: parsed.value.attempt_id,
    p_answers: parsed.value.answers,
  })
  if (error) return failed(describeDbError(error))

  revalidatePath('/portal/tests')
  revalidatePath('/portal/results')
  return succeeded(data as { score: number; max_score: number; late: boolean })
}
