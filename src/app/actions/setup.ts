'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { describeDbError, failed, parse, succeeded, type ActionResult } from '@/lib/action-result'
import {
  academicConfigSchema, presetConfig, PRESETS, type AcademicConfig,
} from '@/lib/academic-config'
import {
  academicSessionSchema, classArmSchema, classLevelSchema, inviteSchema,
  schoolProfileSchema, subjectSchema, termSchema,
} from '@/lib/validation'
import { z } from 'zod'

export async function updateSchoolProfile(input: unknown): Promise<ActionResult> {
  const parsed = parse(schoolProfileSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase
    .from('schools')
    .update({
      name: parsed.value.name,
      address: parsed.value.address || null,
      phone: parsed.value.phone || null,
      email: parsed.value.email || null,
    })
    .eq('id', ctx.school.id)

  if (error) return failed(describeDbError(error))
  revalidatePath('/settings')
  return succeeded()
}

export async function updateAcademicConfig(input: unknown): Promise<ActionResult> {
  const parsed = parse(academicConfigSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase
    .from('school_settings')
    .update({ academic_config: parsed.value })
    .eq('school_id', ctx.school.id)

  if (error) return failed(describeDbError(error))
  revalidatePath('/settings/academic')
  return succeeded()
}

const onboardingSchema = z.object({
  profile: schoolProfileSchema,
  preset_key: z.enum(['NG', 'GH', 'KE']),
  session: academicSessionSchema,
  terms: z.array(termSchema).min(1).max(12),
  class_levels: z.array(classLevelSchema).min(1).max(40),
  arms_per_level: z.array(z.string().trim().min(1).max(30)).min(1).max(12),
  subjects: z.array(subjectSchema).min(1).max(60),
  current_term_ordinal: z.coerce.number().int().min(1).max(12),
})

/**
 * The first-login wizard. Writes the whole school setup, then marks the school
 * onboarded. Anything that fails part-way leaves the wizard re-runnable
 * because every insert is keyed on a natural unique constraint.
 */
export async function completeOnboarding(input: unknown): Promise<ActionResult> {
  const parsed = parse(onboardingSchema, input)
  if (!parsed.ok) return parsed.result
  const v = parsed.value

  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const schoolId = ctx.school.id

  const config: AcademicConfig = {
    ...presetConfig(v.preset_key),
    terms_per_session: v.terms.length,
    term_templates: v.terms.map((t) => ({ ordinal: t.ordinal, label: t.label })),
  }

  const profileUpdate = await supabase
    .from('schools')
    .update({
      name: v.profile.name,
      address: v.profile.address || null,
      phone: v.profile.phone || null,
      email: v.profile.email || null,
    })
    .eq('id', schoolId)
  if (profileUpdate.error) return failed(describeDbError(profileUpdate.error))

  const sessionInsert = await supabase
    .from('academic_sessions')
    .upsert(
      { school_id: schoolId, label: v.session.label, starts_on: v.session.starts_on, ends_on: v.session.ends_on },
      { onConflict: 'school_id,label' },
    )
    .select('id')
    .single()
  if (sessionInsert.error) return failed(describeDbError(sessionInsert.error))
  const sessionId = sessionInsert.data.id

  const termsInsert = await supabase
    .from('terms')
    .upsert(
      v.terms.map((t) => ({
        school_id: schoolId,
        academic_session_id: sessionId,
        ordinal: t.ordinal,
        label: t.label,
        starts_on: t.starts_on,
        ends_on: t.ends_on,
      })),
      { onConflict: 'academic_session_id,ordinal' },
    )
    .select('id, ordinal')
  if (termsInsert.error) return failed(describeDbError(termsInsert.error))

  const levelsInsert = await supabase
    .from('class_levels')
    .upsert(
      v.class_levels.map((l) => ({ school_id: schoolId, label: l.label, ordinal: l.ordinal })),
      { onConflict: 'school_id,label' },
    )
    .select('id')
  if (levelsInsert.error) return failed(describeDbError(levelsInsert.error))

  const arms = levelsInsert.data.flatMap((level) =>
    v.arms_per_level.map((label) => ({ school_id: schoolId, class_level_id: level.id, label })),
  )
  const armsInsert = await supabase
    .from('class_arms')
    .upsert(arms, { onConflict: 'class_level_id,label' })
  if (armsInsert.error) return failed(describeDbError(armsInsert.error))

  const subjectsInsert = await supabase
    .from('subjects')
    .upsert(
      v.subjects.map((s) => ({ school_id: schoolId, name: s.name, code: s.code, is_core: s.is_core })),
      { onConflict: 'school_id,code' },
    )
  if (subjectsInsert.error) return failed(describeDbError(subjectsInsert.error))

  // Exactly one current session and one current term, enforced by partial
  // unique indexes; clear the old flags before setting the new ones.
  await supabase.from('academic_sessions').update({ is_current: false }).eq('school_id', schoolId)
  await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId)
  await supabase.from('academic_sessions').update({ is_current: true }).eq('id', sessionId)

  const currentTerm = termsInsert.data.find((t) => t.ordinal === v.current_term_ordinal)
  if (currentTerm) {
    const flag = await supabase.from('terms').update({ is_current: true }).eq('id', currentTerm.id)
    if (flag.error) return failed(describeDbError(flag.error))
  }

  const settings = await supabase
    .from('school_settings')
    .update({ preset_key: v.preset_key, academic_config: config, onboarded_at: new Date().toISOString() })
    .eq('school_id', schoolId)
  if (settings.error) return failed(describeDbError(settings.error))

  revalidatePath('/', 'layout')
  return succeeded()
}

export async function createClassLevel(input: unknown): Promise<ActionResult> {
  const parsed = parse(classLevelSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase.from('class_levels').insert({ school_id: ctx.school.id, ...parsed.value })
  if (error) return failed(describeDbError(error))
  revalidatePath('/settings/classes')
  return succeeded()
}

export async function createClassArm(input: unknown): Promise<ActionResult> {
  const parsed = parse(classArmSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase.from('class_arms').insert({
    school_id: ctx.school.id,
    class_level_id: parsed.value.class_level_id,
    label: parsed.value.label,
    capacity: parsed.value.capacity ?? null,
    form_teacher_id: parsed.value.form_teacher_id || null,
  })
  if (error) return failed(describeDbError(error))
  revalidatePath('/settings/classes')
  return succeeded()
}

export async function createSubject(input: unknown): Promise<ActionResult> {
  const parsed = parse(subjectSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase.from('subjects').insert({ school_id: ctx.school.id, ...parsed.value })
  if (error) return failed(describeDbError(error))
  revalidatePath('/settings/subjects')
  return succeeded()
}

export async function createTerm(input: unknown): Promise<ActionResult> {
  const schema = termSchema.and(z.object({ academic_session_id: z.string().uuid() }))
  const parsed = parse(schema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { id: _ignored, ...term } = parsed.value
  const { error } = await supabase.from('terms').insert({ school_id: ctx.school.id, ...term })
  if (error) return failed(describeDbError(error))
  revalidatePath('/settings/academic')
  return succeeded()
}

export async function setCurrentTerm(termId: string): Promise<ActionResult> {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  await supabase.from('terms').update({ is_current: false }).eq('school_id', ctx.school.id)
  const { error } = await supabase
    .from('terms')
    .update({ is_current: true })
    .eq('id', termId)
    .eq('school_id', ctx.school.id)
  if (error) return failed(describeDbError(error))
  revalidatePath('/', 'layout')
  return succeeded()
}

export async function inviteMember(input: unknown): Promise<ActionResult> {
  const parsed = parse(inviteSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase
    .from('school_invitations')
    .upsert(
      { school_id: ctx.school.id, email: parsed.value.email, role: parsed.value.role, invited_by: ctx.userId },
      { onConflict: 'school_id,email' },
    )
  if (error) return failed(describeDbError(error))
  revalidatePath('/settings/people')
  return succeeded()
}

export async function presetOptions() {
  return Object.values(PRESETS).map((p) => ({ key: p.key, label: p.label }))
}
