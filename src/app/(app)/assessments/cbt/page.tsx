import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listTerms } from '@/lib/queries'
import {
  Badge, Card, CardHeader, CardTitle, DataTable, EmptyState, PageHeader, Td, Th,
} from '@/components/ui/primitives'
import { CbtTestForm } from '@/components/assessments/cbt-test-form'
import type { AssessmentStatus } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Online tests' }

type Row = {
  id: string
  title: string
  duration_minutes: number
  opens_at: string
  closes_at: string
  status: AssessmentStatus
  subject: { name: string } | null
  class_level: { label: string } | null
}

export default async function CbtListPage() {
  const ctx = await requireSchool()
  const supabase = await createClient()

  const [{ data: tests }, { data: levels }, { data: subjects }, { data: assessments }, terms] =
    await Promise.all([
      supabase
        .from('cbt_tests')
        .select(
          'id, title, duration_minutes, opens_at, closes_at, status, subject:subjects(name), class_level:class_levels(label)',
        )
        .eq('school_id', ctx.school.id)
        .order('created_at', { ascending: false })
        .returns<Row[]>(),
      supabase.from('class_levels').select('id, label').eq('school_id', ctx.school.id).order('ordinal'),
      supabase.from('subjects').select('id, name').eq('school_id', ctx.school.id).order('name'),
      supabase
        .from('assessments')
        .select('id, title')
        .eq('school_id', ctx.school.id)
        .order('created_at', { ascending: false })
        .limit(100),
      listTerms(ctx.school.id),
    ])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Online tests"
        description="Objective papers marked automatically. Link one to an assessment and the score lands in the mark book."
        actions={
          <Link
            href="/assessments"
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
          >
            All assessments
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Papers</CardTitle>
            <Badge>{tests?.length ?? 0}</Badge>
          </CardHeader>
          {tests && tests.length > 0 ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Paper</Th>
                  <Th className="hidden sm:table-cell">Class</Th>
                  <Th className="hidden md:table-cell">Window</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} className="hover:bg-canvas/60">
                    <Td>
                      <Link href={`/assessments/cbt/${t.id}`} className="font-medium underline-offset-2 hover:underline">
                        {t.title}
                      </Link>
                      <span className="block text-[12px] text-ink-muted">
                        {t.subject?.name} · {t.duration_minutes} min
                      </span>
                    </Td>
                    <Td className="hidden sm:table-cell">{t.class_level?.label}</Td>
                    <Td className="hidden text-[13px] text-ink-muted md:table-cell">
                      {new Date(t.opens_at).toLocaleDateString()} –{' '}
                      {new Date(t.closes_at).toLocaleDateString()}
                    </Td>
                    <Td>
                      <Badge tone={t.status === 'published' ? 'positive' : 'neutral'} className="capitalize">
                        {t.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState title="No papers yet" description="Create one on the right, then add its questions." />
          )}
        </Card>

        <div className="no-print">
          <CbtTestForm
            terms={terms.map((t) => ({ id: t.id, label: `${t.session_label} · ${t.label}`, isCurrent: t.is_current }))}
            levels={levels ?? []}
            subjects={subjects ?? []}
            assessments={assessments ?? []}
          />
        </div>
      </div>
    </div>
  )
}
