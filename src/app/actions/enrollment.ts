'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { describeDbError, failed, parse, succeeded, type ActionResult } from '@/lib/action-result'
import { enrollSchema, rolloverSchema } from '@/lib/validation'

export async function enrollStudents(input: unknown): Promise<ActionResult<{ count: number }>> {
  const parsed = parse(enrollSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('enroll_students', {
    p_school_id: ctx.school.id,
    p_term_id: parsed.value.term_id,
    p_class_arm_id: parsed.value.class_arm_id,
    p_student_ids: parsed.value.student_ids,
  })
  if (error) return failed(describeDbError(error))

  revalidatePath('/enrollment')
  return succeeded({ count: data ?? 0 })
}

/**
 * Mid-term movement. The enrollment row is updated rather than replaced, so
 * the attendance already taken against it stays attached to the student.
 */
export async function moveEnrollment(input: unknown): Promise<ActionResult> {
  const parsed = parse(
    z.object({ enrollment_id: z.string().uuid(), class_arm_id: z.string().uuid() }),
    input,
  )
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('enrollments')
    .update({ class_arm_id: parsed.value.class_arm_id })
    .eq('id', parsed.value.enrollment_id)
    .eq('school_id', ctx.school.id)
  if (error) return failed(describeDbError(error))

  revalidatePath('/enrollment')
  return succeeded()
}

export async function setEnrollmentStatus(input: unknown): Promise<ActionResult> {
  const parsed = parse(
    z.object({
      enrollment_id: z.string().uuid(),
      status: z.enum(['active', 'promoted', 'repeated', 'withdrawn', 'transferred_out', 'graduated']),
    }),
    input,
  )
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('enrollments')
    .update({ status: parsed.value.status })
    .eq('id', parsed.value.enrollment_id)
    .eq('school_id', ctx.school.id)
  if (error) return failed(describeDbError(error))

  revalidatePath('/enrollment')
  return succeeded()
}

/**
 * End-of-term rollover. Writes fresh enrollment rows in the next term and
 * closes the old ones; nothing is deleted, so the term just closed remains
 * readable exactly as it was.
 */
export async function rolloverTerm(input: unknown): Promise<ActionResult<{ moved: number }>> {
  const parsed = parse(rolloverSchema, input)
  if (!parsed.ok) return parsed.result
  if (parsed.value.from_term === parsed.value.to_term) {
    return failed('Choose a different term to roll into.')
  }

  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('rollover_term', {
    p_school_id: ctx.school.id,
    p_from_term: parsed.value.from_term,
    p_to_term: parsed.value.to_term,
    p_promote: parsed.value.mapping,
  })
  if (error) return failed(describeDbError(error))

  revalidatePath('/enrollment')
  return succeeded({ moved: data ?? 0 })
}
