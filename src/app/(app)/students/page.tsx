import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  Badge, Card, DataTable, EmptyState, PageHeader, Td, Th,
} from '@/components/ui/primitives'
import { StudentFilters } from '@/components/students/filters'
import { PrintButton } from '@/components/print-button'
import type { StudentStatus } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Students' }

const PAGE_SIZE = 25

const STATUS_TONE: Record<StudentStatus, 'positive' | 'neutral' | 'warn'> = {
  active: 'positive',
  graduated: 'neutral',
  withdrawn: 'warn',
  transferred: 'warn',
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const ctx = await requireRole('school_admin')
  const { q = '', status = 'active', page = '1' } = await searchParams
  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1)
  const from = (pageNumber - 1) * PAGE_SIZE

  const supabase = await createClient()
  let query = supabase
    .from('students')
    .select('id, admission_number, first_name, last_name, middle_name, sex, status, admitted_on', {
      count: 'exact',
    })
    .eq('school_id', ctx.school.id)
    .order('last_name')
    .order('first_name')
    .range(from, from + PAGE_SIZE - 1)

  if (status !== 'all') query = query.eq('status', status as StudentStatus)
  if (q.trim()) {
    const term = `%${q.trim()}%`
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},admission_number.ilike.${term}`,
    )
  }

  const { data, count, error } = await query
  const total = count ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Students"
        description={`${total} record${total === 1 ? '' : 's'}`}
        actions={
          <>
            <PrintButton />
            <Link
              href="/students/import"
              className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
            >
              Import CSV
            </Link>
            <Link
              href="/students/new"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-[13px] font-medium text-white"
            >
              Add student
            </Link>
          </>
        }
      />

      <StudentFilters q={q} status={status} />

      <Card>
        {error ? (
          <EmptyState title="Could not load students" description={error.message} />
        ) : data && data.length > 0 ? (
          <>
            <DataTable>
              <thead>
                <tr>
                  <Th>Admission no.</Th>
                  <Th>Name</Th>
                  <Th className="hidden sm:table-cell">Sex</Th>
                  <Th className="hidden sm:table-cell">Admitted</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} className="hover:bg-canvas/60">
                    <Td className="font-mono text-[13px] tabular-nums">{s.admission_number}</Td>
                    <Td>
                      <Link
                        href={`/students/${s.id}`}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {s.last_name} {s.first_name} {s.middle_name ?? ''}
                      </Link>
                    </Td>
                    <Td className="hidden capitalize sm:table-cell">{s.sex ?? '—'}</Td>
                    <Td className="hidden tabular-nums sm:table-cell">{s.admitted_on}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[s.status]} className="capitalize">
                        {s.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            <div className="no-print flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
              <span className="text-ink-muted">
                Page {pageNumber} of {lastPage}
              </span>
              <div className="flex gap-2">
                <PageLink q={q} status={status} page={pageNumber - 1} disabled={pageNumber <= 1}>
                  Previous
                </PageLink>
                <PageLink q={q} status={status} page={pageNumber + 1} disabled={pageNumber >= lastPage}>
                  Next
                </PageLink>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title={q ? 'No students match that search' : 'No students yet'}
            description={
              q
                ? 'Try a different name or admission number.'
                : 'Add students one at a time, or import the spreadsheet you already have.'
            }
            action={
              <Link
                href="/students/import"
                className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white"
              >
                Import a CSV
              </Link>
            }
          />
        )}
      </Card>
    </div>
  )
}

function PageLink({
  q, status, page, disabled, children,
}: {
  q: string; status: string; page: number; disabled: boolean; children: React.ReactNode
}) {
  if (disabled) {
    return <span className="rounded-lg border border-line px-3 py-1.5 text-ink-muted/60">{children}</span>
  }
  const params = new URLSearchParams({ status, page: String(page) })
  if (q) params.set('q', q)
  return (
    <Link href={`/students?${params}`} className="rounded-lg border border-line px-3 py-1.5 hover:bg-canvas">
      {children}
    </Link>
  )
}
