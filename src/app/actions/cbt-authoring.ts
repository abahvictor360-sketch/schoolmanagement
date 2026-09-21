'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSchool } from '@/lib/auth'
import { describeDbError, failed, parse, succeeded, type ActionResult } from '@/lib/action-result'
import { cbtQuestionSchema, cbtTestSchema } from '@/lib/validation'

async function teaching() {
  const ctx = await requireSchool()
  if (!['school_admin', 'teacher'].includes(ctx.role) && !ctx.isPlatformAdmin) return null
  return ctx
}

export async function createCbtTest(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(cbtTestSchema, input)
  if (!parsed.ok) return parsed.result
  if (new Date(parsed.value.closes_at) <= new Date(parsed.value.opens_at)) {
    return failed('The paper must close after it opens.')
  }

  const ctx = await teaching()
  if (!ctx) return failed('Only teachers and administrators may set a paper.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cbt_tests')
    .insert({
      school_id: ctx.school.id,
      created_by: ctx.userId,
      ...parsed.value,
      opens_at: new Date(parsed.value.opens_at).toISOString(),
      closes_at: new Date(parsed.value.closes_at).toISOString(),
    })
    .select('id')
    .single()
  if (error) return failed(describeDbError(error))

  revalidatePath('/assessments/cbt')
  return succeeded({ id: data.id })
}

/**
 * Adds a question, its options and its answer key together. The key goes into
 * cbt_answer_keys, which no candidate can read, so authoring and marking share
 * one write and cannot drift apart.
 */
export async function addQuestion(input: unknown): Promise<ActionResult> {
  const parsed = parse(cbtQuestionSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await teaching()
  if (!ctx) return failed('Only teachers and administrators may edit a paper.')

  const supabase = await createClient()

  const { count } = await supabase
    .from('cbt_questions')
    .select('id', { count: 'exact', head: true })
    .eq('test_id', parsed.value.test_id)

  const question = await supabase
    .from('cbt_questions')
    .insert({
      school_id: ctx.school.id,
      test_id: parsed.value.test_id,
      ordinal: (count ?? 0) + 1,
      prompt: parsed.value.prompt,
      kind: parsed.value.kind,
      marks: parsed.value.marks,
    })
    .select('id')
    .single()
  if (question.error) return failed(describeDbError(question.error))

  const options = await supabase
    .from('cbt_options')
    .insert(
      parsed.value.options.map((label, index) => ({
        school_id: ctx.school.id,
        question_id: question.data.id,
        ordinal: index + 1,
        label,
      })),
    )
    .select('id, ordinal')
  if (options.error) return failed(describeDbError(options.error))

  const byOrdinal = new Map(options.data.map((o) => [o.ordinal, o.id]))
  const key = parsed.value.correct
    .map((index) => byOrdinal.get(index + 1))
    .filter((id): id is string => Boolean(id))

  const wrote = await supabase.from('cbt_answer_keys').insert({
    question_id: question.data.id,
    school_id: ctx.school.id,
    option_ids: key,
  })
  if (wrote.error) return failed(describeDbError(wrote.error))

  revalidatePath(`/assessments/cbt/${parsed.value.test_id}`)
  return succeeded()
}

export async function deleteQuestion(questionId: string, testId: string): Promise<ActionResult> {
  const ctx = await teaching()
  if (!ctx) return failed('Only teachers and administrators may edit a paper.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('cbt_questions')
    .delete()
    .eq('id', questionId)
    .eq('school_id', ctx.school.id)
  if (error) return failed(describeDbError(error))

  revalidatePath(`/assessments/cbt/${testId}`)
  return succeeded()
}

export async function setCbtStatus(
  testId: string,
  status: 'draft' | 'published',
): Promise<ActionResult> {
  const ctx = await teaching()
  if (!ctx) return failed('Only teachers and administrators may publish a paper.')

  const supabase = await createClient()

  if (status === 'published') {
    const { count } = await supabase
      .from('cbt_questions')
      .select('id', { count: 'exact', head: true })
      .eq('test_id', testId)
    if ((count ?? 0) === 0) return failed('Add at least one question before publishing.')
  }

  const { error } = await supabase
    .from('cbt_tests')
    .update({ status })
    .eq('id', testId)
    .eq('school_id', ctx.school.id)
  if (error) return failed(describeDbError(error))

  revalidatePath('/assessments/cbt')
  revalidatePath(`/assessments/cbt/${testId}`)
  return succeeded()
}
