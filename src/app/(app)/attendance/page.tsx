import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listArms, listTerms } from '@/lib/queries'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Attendance' }

export default async function AttendancePage() {
  const ctx = await requireSchool()
  const [arms, terms] = await Promise.all([listArms(ctx.school.id), listTerms(ctx.school.id)])
  const currentTerm = terms.find((t) => t.is_current)
  const today = new Date().toISOString().slice(0, 10)

  const supabase = await createClient()
  const { data: taken } = await supabase
    .from('attendance_registers')
    .select('class_arm_id')
    .eq('school_id', ctx.school.id)
    .eq('register_date', today)

  const takenIds = new Set((taken ?? []).map((r) => r.class_arm_id))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance"
        description={
          currentTerm
            ? `${currentTerm.session_label} · ${currentTerm.label} · ${today}`
            : 'No current term is set.'
        }
        actions={
          <Link
            href="/attendance/summary"
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
          >
            Term summary
          </Link>
        }
      />

      {!currentTerm || arms.length === 0 ? (
        <Card>
          <EmptyState
            title="Attendance is not ready yet"
            description="A current term and at least one class arm are needed before a register can be taken."
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {arms.map((arm) => (
            <li key={arm.id}>
              <Link
                href={`/attendance/${arm.id}`}
                className="flex min-h-[72px] items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-4 py-3 transition-colors hover:border-accent/40 hover:bg-accent-soft/30"
              >
                <span>
                  <span className="block text-sm font-medium">{arm.full_label}</span>
                  <span className="block text-[13px] text-ink-muted">
                    {takenIds.has(arm.id) ? 'Register taken today' : 'Not taken yet'}
                  </span>
                </span>
                <Badge tone={takenIds.has(arm.id) ? 'positive' : 'warn'}>
                  {takenIds.has(arm.id) ? 'Done' : 'Open'}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
