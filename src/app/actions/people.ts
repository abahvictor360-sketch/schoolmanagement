'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { describeDbError, failed, parse, succeeded, type ActionResult } from '@/lib/action-result'
import {
  guardianSchema, linkGuardianSchema, staffImportRow, staffSchema,
  studentImportRow, studentSchema,
} from '@/lib/validation'

export async function createStudent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(studentSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('students')
    .insert({ school_id: ctx.school.id, ...parsed.value })
    .select('id')
    .single()
  if (error) return failed(describeDbError(error))
  revalidatePath('/students')
  return succeeded({ id: data.id })
}

export async function updateStudent(id: string, input: unknown): Promise<ActionResult> {
  const parsed = parse(studentSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase
    .from('students')
    .update(parsed.value)
    .eq('id', id)
    .eq('school_id', ctx.school.id)
  if (error) return failed(describeDbError(error))
  revalidatePath('/students')
  revalidatePath(`/students/${id}`)
  return succeeded()
}

/** Signs a short-lived upload URL scoped to <school_id>/<student_id>. */
export async function studentPhotoUploadTarget(studentId: string) {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const path = `${ctx.school.id}/${studentId}.jpg`
  const { data, error } = await supabase.storage.from('student-photos').createSignedUploadUrl(path, {
    upsert: true,
  })
  if (error) return failed(error.message)
  return succeeded({ path, token: data.token })
}

export async function setStudentPhotoPath(studentId: string, path: string): Promise<ActionResult> {
  const ctx = await requireRole('school_admin')
  if (!path.startsWith(`${ctx.school.id}/`)) return failed('Invalid photo path.')
  const supabase = await createClient()
  const { error } = await supabase
    .from('students')
    .update({ photo_path: path })
    .eq('id', studentId)
    .eq('school_id', ctx.school.id)
  if (error) return failed(describeDbError(error))
  revalidatePath(`/students/${studentId}`)
  return succeeded()
}

export async function createGuardian(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(guardianSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('guardians')
    .insert({ school_id: ctx.school.id, ...parsed.value })
    .select('id')
    .single()
  if (error) return failed(describeDbError(error))
  revalidatePath('/guardians')
  return succeeded({ id: data.id })
}

export async function linkGuardian(input: unknown): Promise<ActionResult> {
  const parsed = parse(linkGuardianSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  // At most one primary guardian per student (partial unique index).
  if (parsed.value.is_primary) {
    await supabase
      .from('student_guardians')
      .update({ is_primary: false })
      .eq('school_id', ctx.school.id)
      .eq('student_id', parsed.value.student_id)
  }

  const { error } = await supabase
    .from('student_guardians')
    .upsert({ school_id: ctx.school.id, ...parsed.value }, { onConflict: 'student_id,guardian_id' })
  if (error) return failed(describeDbError(error))
  revalidatePath(`/students/${parsed.value.student_id}`)
  return succeeded()
}

export async function unlinkGuardian(linkId: string, studentId: string): Promise<ActionResult> {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase
    .from('student_guardians')
    .delete()
    .eq('id', linkId)
    .eq('school_id', ctx.school.id)
  if (error) return failed(describeDbError(error))
  revalidatePath(`/students/${studentId}`)
  return succeeded()
}

export async function createStaff(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(staffSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .insert({ school_id: ctx.school.id, ...parsed.value })
    .select('id')
    .single()
  if (error) return failed(describeDbError(error))
  revalidatePath('/staff')
  return succeeded({ id: data.id })
}

export async function updateStaff(id: string, input: unknown): Promise<ActionResult> {
  const parsed = parse(staffSchema, input)
  if (!parsed.ok) return parsed.result
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase
    .from('staff')
    .update(parsed.value)
    .eq('id', id)
    .eq('school_id', ctx.school.id)
  if (error) return failed(describeDbError(error))
  revalidatePath('/staff')
  return succeeded()
}

/* -------------------------------------------------------------- CSV import */

const studentImportSchema = z.object({
  rows: z.array(studentImportRow).min(1).max(2000),
  term_id: z.string().uuid().optional().or(z.literal('')),
})

/**
 * Commits a previewed-and-corrected student import. Rows naming a class arm
 * are enrolled into it for the chosen term in the same call, because a school
 * arriving with a spreadsheet has the class in the spreadsheet.
 */
export async function importStudents(
  input: unknown,
): Promise<ActionResult<{ inserted: number; enrolled: number }>> {
  const parsed = parse(studentImportSchema, input)
  if (!parsed.ok) return parsed.result
  const { rows, term_id } = parsed.value

  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const inserted = await supabase
    .from('students')
    .upsert(
      rows.map((r) => ({
        school_id: ctx.school.id,
        admission_number: r.admission_number,
        first_name: r.first_name,
        last_name: r.last_name,
        middle_name: r.middle_name || null,
        date_of_birth: r.date_of_birth || null,
        sex: (r.sex || null) as 'male' | 'female' | null,
      })),
      { onConflict: 'school_id,admission_number' },
    )
    .select('id, admission_number')
  if (inserted.error) return failed(describeDbError(inserted.error))

  let enrolled = 0
  const withArms = rows.filter((r) => r.class_arm)
  if (term_id && withArms.length > 0) {
    const arms = await supabase
      .from('class_arms')
      .select('id, label, class_level:class_levels!inner(label)')
      .eq('school_id', ctx.school.id)
      .returns<{ id: string; label: string; class_level: { label: string } }[]>()
    if (arms.error) return failed(describeDbError(arms.error))

    const byName = new Map(
      arms.data.map((a) => [`${a.class_level.label} ${a.label}`.toLowerCase(), a.id]),
    )
    const idByAdmission = new Map(inserted.data.map((s) => [s.admission_number, s.id]))

    const groups = new Map<string, string[]>()
    for (const row of withArms) {
      const armId = byName.get(row.class_arm.trim().toLowerCase())
      const studentId = idByAdmission.get(row.admission_number)
      if (!armId || !studentId) continue
      groups.set(armId, [...(groups.get(armId) ?? []), studentId])
    }

    for (const [armId, studentIds] of groups) {
      const { data, error } = await supabase.rpc('enroll_students', {
        p_school_id: ctx.school.id,
        p_term_id: term_id,
        p_class_arm_id: armId,
        p_student_ids: studentIds,
      })
      if (error) return failed(describeDbError(error))
      enrolled += data ?? 0
    }
  }

  revalidatePath('/students')
  return succeeded({ inserted: inserted.data.length, enrolled })
}

export async function importStaff(input: unknown): Promise<ActionResult<{ inserted: number }>> {
  const parsed = parse(z.object({ rows: z.array(staffImportRow).min(1).max(2000) }), input)
  if (!parsed.ok) return parsed.result

  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .upsert(
      parsed.value.rows.map((r) => ({
        school_id: ctx.school.id,
        staff_number: r.staff_number,
        full_name: r.full_name,
        email: r.email || null,
        phone: r.phone || null,
        designation: r.designation || null,
      })),
      { onConflict: 'school_id,staff_number' },
    )
    .select('id')
  if (error) return failed(describeDbError(error))

  revalidatePath('/staff')
  return succeeded({ inserted: data.length })
}
