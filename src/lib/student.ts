import { cache } from 'react'
import { redirect } from 'next/navigation'
import { requireSchool, type SchoolContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { StudentRow } from '@/lib/database.types'

export type StudentContext = SchoolContext & {
  student: StudentRow
  /** The enrollment for the current term, if the pupil has one. */
  enrollment: {
    id: string
    term_id: string
    term_label: string
    session_label: string
    class_arm_id: string
    class_label: string
  } | null
}

/**
 * Resolves the pupil behind the current login. RLS already limits what the
 * query can return, so this cannot pick up someone else's record even if the
 * caller tampers with the request.
 */
export const requireStudent = cache(async (): Promise<StudentContext> => {
  const ctx = await requireSchool()
  if (ctx.role !== 'student') redirect('/dashboard')

  const supabase = await createClient()
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('profile_id', ctx.userId)
    .maybeSingle<StudentRow>()

  // A login whose pupil record was unlinked or withdrawn.
  if (!student) redirect('/no-school')

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select(
      'id, term_id, class_arm_id, term:terms!inner(label, is_current, academic_session:academic_sessions(label)), class_arm:class_arms(label, class_level:class_levels(label))',
    )
    .eq('student_id', student.id)
    .eq('term.is_current', true)
    .maybeSingle<{
      id: string
      term_id: string
      class_arm_id: string
      term: { label: string; is_current: boolean; academic_session: { label: string } | null }
      class_arm: { label: string; class_level: { label: string } } | null
    }>()

  return {
    ...ctx,
    student,
    enrollment: enrollment
      ? {
          id: enrollment.id,
          term_id: enrollment.term_id,
          term_label: enrollment.term.label,
          session_label: enrollment.term.academic_session?.label ?? '',
          class_arm_id: enrollment.class_arm_id,
          class_label: enrollment.class_arm
            ? `${enrollment.class_arm.class_level.label} ${enrollment.class_arm.label}`
            : 'Not assigned',
        }
      : null,
  }
})
