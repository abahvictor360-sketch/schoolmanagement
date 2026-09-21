import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listTerms } from '@/lib/queries'
import {
  Badge, Card, CardHeader, CardTitle, DataTable, EmptyState, PageHeader, Td, Th,
} from '@/components/ui/primitives'
import { AssessmentForm } from '@/components/assessments/assessment-form'
import type { AssessmentStatus } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Assessments' }

type Row = {
  id: string
  title: string
  component_key: string
  max_score: number
  held_on: string | null
  status: AssessmentStatus
  subject: { name: string } | null
  class_level: { label: string } | null
  term: { label: string } | null
}

export default async function AssessmentsPage() {
  const ctx = await requireSchool()
  const supabase = await createClient()

  const [{ data: rows }, { data: levels }, { data: subjects }, terms] = await Promise.all([
    supabase
      .from('assessments')
      .select(
        'id, title, component_key, max_score, held_on, status, subject:subjects(name), class_level:class_levels(label), term:terms(label)',
      )
      .eq('school_id', ctx.school.id)
      .order('created_at', { ascending: false })
      .limit(200)
      .returns<Row[]>(),
    supabase.from('class_levels').select('id, label').eq('school_id', ctx.school.id).order('ordinal'),
    supabase.from('subjects').select('id, name').eq('school_id', ctx.school.id).order('name'),
    listTerms(ctx.school.id),
  ])

  const componentLabel = (key: string) =>
    ctx.config.assessment_components.find((c) => c.key === key)?.label ?? key

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assessments"
        description="Marks recorded here feed each pupil's report card, weighted by this school's own grading scheme."
        actions={
          <Link
            href="/assessments/cbt"
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
          >
            Online tests
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>All assessments</CardTitle>
            <Badge>{rows?.length ?? 0}</Badge>
          </CardHeader>
          {rows && rows.length > 0 ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th className="hidden sm:table-cell">Class</Th>
                  <Th className="hidden md:table-cell">Component</Th>
                  <Th className="text-right">Max</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-canvas/60">
                    <Td>
                      <Link href={`/assessments/${a.id}`} className="font-medium underline-offset-2 hover:underline">
                        {a.title}
                      </Link>
                      <span className="block text-[12px] text-ink-muted">{a.subject?.name}</span>
                    </Td>
                    <Td className="hidden sm:table-cell">{a.class_level?.label}</Td>
                    <Td className="hidden md:table-cell">{componentLabel(a.component_key)}</Td>
                    <Td className="text-right tabular-nums">{a.max_score}</Td>
                    <Td>
                      <Badge tone={a.status === 'published' ? 'positive' : 'neutral'} className="capitalize">
                        {a.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState
              title="No assessments yet"
              description="Set one on the right, then enter the marks."
            />
          )}
        </Card>

        <div className="no-print">
          <AssessmentForm
            terms={terms.map((t) => ({ id: t.id, label: `${t.session_label} · ${t.label}`, isCurrent: t.is_current }))}
            levels={levels ?? []}
            subjects={subjects ?? []}
            components={ctx.config.assessment_components}
          />
        </div>
      </div>
    </div>
  )
}
