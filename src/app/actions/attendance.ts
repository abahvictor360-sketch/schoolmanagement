'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSchool } from '@/lib/auth'
import { describeDbError, failed, parse, succeeded, type ActionResult } from '@/lib/action-result'
import { attendanceSchema } from '@/lib/validation'

/**
 * A register is saved whole, in one round trip. On a patchy connection a
 * half-saved class is worse than an unsaved one, so there is no per-pupil
 * write path at all.
 */
export async function saveRegister(input: unknown): Promise<ActionResult<{ registerId: string }>> {
  const parsed = parse(attendanceSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await requireSchool()
  if (!['school_admin', 'teacher'].includes(ctx.role) && !ctx.isPlatformAdmin) {
    return failed('Only teachers and administrators may take attendance.')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_attendance', {
    p_school_id: ctx.school.id,
    p_class_arm_id: parsed.value.class_arm_id,
    p_term_id: parsed.value.term_id,
    p_date: parsed.value.register_date,
    p_entries: parsed.value.entries.map((e) => ({
      enrollment_id: e.enrollment_id,
      status: e.status,
      note: e.note ?? '',
    })),
  })
  if (error) return failed(describeDbError(error))

  revalidatePath('/attendance')
  return succeeded({ registerId: data as string })
}
