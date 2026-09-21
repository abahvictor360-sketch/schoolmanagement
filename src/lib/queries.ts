import { createClient } from '@/lib/supabase/server'

export type TermOption = {
  id: string
  label: string
  ordinal: number
  is_current: boolean
  session_label: string
}

export type ArmOption = {
  id: string
  label: string
  level_label: string
  level_ordinal: number
  full_label: string
}

export async function listTerms(schoolId: string): Promise<TermOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('terms')
    .select('id, label, ordinal, is_current, academic_session:academic_sessions(label, starts_on)')
    .eq('school_id', schoolId)
    .order('ordinal')
    .returns<
      { id: string; label: string; ordinal: number; is_current: boolean; academic_session: { label: string; starts_on: string } | null }[]
    >()

  return (data ?? [])
    .map((t) => ({
      id: t.id,
      label: t.label,
      ordinal: t.ordinal,
      is_current: t.is_current,
      session_label: t.academic_session?.label ?? '',
    }))
    .sort((a, b) => a.session_label.localeCompare(b.session_label) || a.ordinal - b.ordinal)
}

export async function listArms(schoolId: string): Promise<ArmOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('class_arms')
    .select('id, label, class_level:class_levels(label, ordinal)')
    .eq('school_id', schoolId)
    .returns<{ id: string; label: string; class_level: { label: string; ordinal: number } }[]>()

  return (data ?? [])
    .map((a) => ({
      id: a.id,
      label: a.label,
      level_label: a.class_level.label,
      level_ordinal: a.class_level.ordinal,
      full_label: `${a.class_level.label} ${a.label}`,
    }))
    .sort((a, b) => a.level_ordinal - b.level_ordinal || a.label.localeCompare(b.label))
}
