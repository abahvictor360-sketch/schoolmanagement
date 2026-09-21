import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/primitives'
import { StudentImport } from '@/components/students/student-import'

export const metadata: Metadata = { title: 'Import students' }

export default async function ImportStudentsPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const [{ data: terms }, { data: arms }] = await Promise.all([
    supabase
      .from('terms')
      .select('id, label, is_current, academic_session:academic_sessions(label)')
      .eq('school_id', ctx.school.id)
      .order('starts_on', { ascending: false })
      .returns<{ id: string; label: string; is_current: boolean; academic_session: { label: string } | null }[]>(),
    supabase
      .from('class_arms')
      .select('id, label, class_level:class_levels(label, ordinal)')
      .eq('school_id', ctx.school.id)
      .returns<{ id: string; label: string; class_level: { label: string; ordinal: number } }[]>(),
  ])

  const armNames = (arms ?? [])
    .sort((a, b) => a.class_level.ordinal - b.class_level.ordinal || a.label.localeCompare(b.label))
    .map((a) => `${a.class_level.label} ${a.label}`)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Import students"
        description="Upload the spreadsheet you already have. Nothing is saved until you review it."
      />
      <StudentImport
        terms={(terms ?? []).map((t) => ({
          id: t.id,
          label: `${t.academic_session?.label ?? ''} · ${t.label}`,
          isCurrent: t.is_current,
        }))}
        armNames={armNames}
      />
    </div>
  )
}
