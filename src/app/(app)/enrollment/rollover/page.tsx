import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listArms, listTerms } from '@/lib/queries'
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives'
import { RolloverForm } from '@/components/enrollment/rollover-form'

export const metadata: Metadata = { title: 'Term rollover' }

export default async function RolloverPage() {
  const ctx = await requireRole('school_admin')
  const [terms, arms] = await Promise.all([listTerms(ctx.school.id), listArms(ctx.school.id)])

  if (terms.length < 2) {
    return (
      <div className="space-y-4">
        <PageHeader title="End-of-term rollover" />
        <Card>
          <EmptyState
            title="Two terms are needed"
            description="Create the term you are rolling into before running a rollover."
          />
        </Card>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: counts } = await supabase
    .from('enrollments')
    .select('term_id, class_arm_id')
    .eq('school_id', ctx.school.id)
    .eq('status', 'active')
    .returns<{ term_id: string; class_arm_id: string }[]>()

  const tally: Record<string, Record<string, number>> = {}
  for (const row of counts ?? []) {
    tally[row.term_id] ??= {}
    tally[row.term_id]![row.class_arm_id] = (tally[row.term_id]![row.class_arm_id] ?? 0) + 1
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="End-of-term rollover"
        description="Carry each class arm's cohort into the next term. Choose where each arm lands: the same arm to repeat, the next level to promote, or leave it blank to graduate or hold."
      />
      <RolloverForm terms={terms} arms={arms} counts={tally} />
    </div>
  )
}
