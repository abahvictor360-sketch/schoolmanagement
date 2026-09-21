'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole, requireSchool } from '@/lib/auth'
import { describeDbError, failed, parse, succeeded, type ActionResult } from '@/lib/action-result'
import { assessmentSchema } from '@/lib/validation'

const scoresSchema = z.object({
  assessment_id: z.string().uuid(),
  scores: z
    .array(
      z.object({
        enrollment_id: z.string().uuid(),
        score: z.union([z.literal(''), z.coerce.number().min(0).max(1000)]),
      }),
    )
    .max(2000),
})

async function teachingContext() {
  const ctx = await requireSchool()
  if (!['school_admin', 'teacher'].includes(ctx.role) && !ctx.isPlatformAdmin) {
    return null
  }
  return ctx
}

export async function createAssessment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(assessmentSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await teachingContext()
  if (!ctx) return failed('Only teachers and administrators may set work.')

  // The component must be one this school actually uses.
  if (!ctx.config.assessment_components.some((c) => c.key === parsed.value.component_key)) {
    return failed('That assessment component is not part of this school’s grading scheme.')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assessments')
    .insert({ school_id: ctx.school.id, created_by: ctx.userId, ...parsed.value })
    .select('id')
    .single()
  if (error) return failed(describeDbError(error))

  revalidatePath('/assessments')
  return succeeded({ id: data.id })
}

export async function setAssessmentStatus(
  id: string,
  status: 'draft' | 'published',
): Promise<ActionResult> {
  const ctx = await teachingContext()
  if (!ctx) return failed('Only teachers and administrators may publish results.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('assessments')
    .update({ status })
    .eq('id', id)
    .eq('school_id', ctx.school.id)
  if (error) return failed(describeDbError(error))

  revalidatePath('/assessments')
  revalidatePath(`/assessments/${id}`)
  return succeeded()
}

/**
 * Saves a whole mark sheet at once. A blank cell deletes any existing mark
 * rather than storing a zero, because "not marked" and "scored nothing" are
 * different things on a report card.
 */
export async function saveScores(input: unknown): Promise<ActionResult<{ saved: number }>> {
  const parsed = parse(scoresSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await teachingContext()
  if (!ctx) return failed('Only teachers and administrators may enter marks.')

  const supabase = await createClient()
  const filled = parsed.value.scores.filter((s) => s.score !== '')
  const cleared = parsed.value.scores.filter((s) => s.score === '').map((s) => s.enrollment_id)

  if (filled.length > 0) {
    const { error } = await supabase.from('assessment_scores').upsert(
      filled.map((s) => ({
        school_id: ctx.school.id,
        assessment_id: parsed.value.assessment_id,
        enrollment_id: s.enrollment_id,
        score: Number(s.score),
        recorded_by: ctx.userId,
      })),
      { onConflict: 'assessment_id,enrollment_id' },
    )
    if (error) return failed(describeDbError(error))
  }

  if (cleared.length > 0) {
    const { error } = await supabase
      .from('assessment_scores')
      .delete()
      .eq('assessment_id', parsed.value.assessment_id)
      .in('enrollment_id', cleared)
    if (error) return failed(describeDbError(error))
  }

  revalidatePath(`/assessments/${parsed.value.assessment_id}`)
  return succeeded({ saved: filled.length })
}

/**
 * Invites a pupil to the portal. The membership and the link to their record
 * both materialise when they sign up, so no service_role key is involved.
 */
export async function inviteStudentToPortal(input: unknown): Promise<ActionResult> {
  const parsed = parse(
    z.object({
      student_id: z.string().uuid(),
      email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    }),
    input,
  )
  if (!parsed.ok) return parsed.result

  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const { error } = await supabase.from('school_invitations').upsert(
    {
      school_id: ctx.school.id,
      email: parsed.value.email,
      role: 'student' as const,
      student_id: parsed.value.student_id,
      invited_by: ctx.userId,
    },
    { onConflict: 'school_id,email' },
  )
  if (error) return failed(describeDbError(error))

  revalidatePath(`/students/${parsed.value.student_id}`)
  return succeeded()
}
