import type { Metadata } from 'next'
import { requireStudent } from '@/lib/student'
import { createClient } from '@/lib/supabase/server'
import {
  Badge, Card, CardBody, DataTable, EmptyState, PageHeader, Td, Th,
} from '@/components/ui/primitives'
import { PrintButton } from '@/components/print-button'
import type { ResultSheetRow } from '@/lib/database.types'

export const metadata: Metadata = { title: 'My results' }

type Component = { component: string; score: number; max_score: number; weight: number }

export default async function PortalResults() {
  const ctx = await requireStudent()
  if (!ctx.enrollment) {
    return (
      <Card>
        <EmptyState title="Not enrolled this term" description="There are no results to show yet." />
      </Card>
    )
  }

  const supabase = await createClient()
  const { data } = await supabase.rpc('result_sheet', { p_enrollment: ctx.enrollment.id })
  const rows = (data ?? []) as ResultSheetRow[]

  // Component labels come from the school's own configuration, not a constant.
  const componentLabel = (key: string) =>
    ctx.config.assessment_components.find((c) => c.key === key)?.label ?? key

  const average =
    rows.length === 0
      ? null
      : Math.round((rows.reduce((sum, r) => sum + Number(r.percentage ?? 0), 0) / rows.length) * 100) / 100
  const overall = average === null ? null : ctx.config.grade_bands.find(
    (b) => average >= b.min_score && average <= b.max_score,
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="My results"
        description={`${ctx.enrollment.session_label} · ${ctx.enrollment.term_label} · ${ctx.enrollment.class_label}`}
        actions={<PrintButton label="Print report card" />}
      />

      {/* Only shown on paper: a header the school can actually file. */}
      <div className="print-only space-y-1 border-b border-ink pb-3">
        <p className="text-base font-semibold">{ctx.school.name}</p>
        <p className="text-sm">
          {ctx.student.last_name} {ctx.student.first_name} {ctx.student.middle_name ?? ''} ·{' '}
          {ctx.student.admission_number}
        </p>
        <p className="text-sm">
          {ctx.enrollment.class_label} · {ctx.enrollment.session_label}{' '}
          {ctx.enrollment.term_label}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No results published yet"
            description="Your subjects appear here once your teachers publish the marks."
          />
        </Card>
      ) : (
        <>
          <Card>
            <DataTable>
              <thead>
                <tr>
                  <Th>Subject</Th>
                  {ctx.config.assessment_components.map((c) => (
                    <Th key={c.key} className="text-right">
                      {c.label}
                      <span className="block text-[10px] font-normal opacity-70">{c.weight}%</span>
                    </Th>
                  ))}
                  <Th className="text-right">Total</Th>
                  <Th>Grade</Th>
                  <Th className="hidden sm:table-cell">Remark</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const parts = (r.components ?? []) as unknown as Component[]
                  return (
                    <tr key={r.subject_id}>
                      <Td className="font-medium">{r.subject_name}</Td>
                      {ctx.config.assessment_components.map((c) => {
                        const part = parts.find((p) => p.component === c.key)
                        return (
                          <Td key={c.key} className="text-right tabular-nums">
                            {part ? `${part.score}/${part.max_score}` : '—'}
                          </Td>
                        )
                      })}
                      <Td className="text-right font-medium tabular-nums">{r.percentage}%</Td>
                      <Td>
                        <Badge tone={r.is_pass ? 'positive' : 'danger'}>{r.grade_label}</Badge>
                      </Td>
                      <Td className="hidden text-ink-muted sm:table-cell">{r.remark}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          </Card>

          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] text-ink-muted">Average across {rows.length} subjects</p>
                <p className="text-2xl font-semibold tabular-nums">{average}%</p>
              </div>
              {overall ? (
                <div className="text-right">
                  <p className="text-[13px] text-ink-muted">Overall grade</p>
                  <p className="text-2xl font-semibold">{overall.label}</p>
                  <p className="text-[13px] text-ink-muted">{overall.remark}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <p className="text-[12px] text-ink-muted">
            Grades follow {ctx.school.name}&rsquo;s own grading scheme. The pass mark is{' '}
            {ctx.config.pass_mark}%.
          </p>
        </>
      )}
    </div>
  )
}
