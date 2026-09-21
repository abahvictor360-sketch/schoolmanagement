import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const ctx = await requireSchool()
  const supabase = await createClient()

  const { data: term } = await supabase
    .from('terms')
    .select('id, label, starts_on, ends_on, academic_session:academic_sessions(label)')
    .eq('school_id', ctx.school.id)
    .eq('is_current', true)
    .maybeSingle<{
      id: string
      label: string
      starts_on: string
      ends_on: string
      academic_session: { label: string } | null
    }>()

  const [students, staff, arms, enrolled, registersToday] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true })
      .eq('school_id', ctx.school.id).eq('status', 'active'),
    supabase.from('staff').select('id', { count: 'exact', head: true })
      .eq('school_id', ctx.school.id).eq('employment_status', 'active'),
    supabase.from('class_arms').select('id', { count: 'exact', head: true })
      .eq('school_id', ctx.school.id),
    term
      ? supabase.from('enrollments').select('id', { count: 'exact', head: true })
          .eq('school_id', ctx.school.id).eq('term_id', term.id).eq('status', 'active')
      : Promise.resolve({ count: 0 }),
    supabase.from('attendance_registers').select('id', { count: 'exact', head: true })
      .eq('school_id', ctx.school.id).eq('register_date', new Date().toISOString().slice(0, 10)),
  ])

  const stats = [
    { label: 'Active students', value: students.count ?? 0 },
    { label: 'Enrolled this term', value: enrolled.count ?? 0 },
    { label: 'Active staff', value: staff.count ?? 0 },
    { label: 'Class arms', value: arms.count ?? 0 },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Good day, ${ctx.fullName.split(' ')[0] ?? ''}`}
        description={
          term
            ? `${term.academic_session?.label ?? ''} · ${term.label}`
            : 'No current term is set yet.'
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <p className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">{stat.value}</p>
              <p className="mt-1 text-[13px] text-ink-muted">{stat.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance today</CardTitle>
            <Badge tone={registersToday.count ? 'positive' : 'warn'}>
              {registersToday.count ?? 0} of {arms.count ?? 0} registers taken
            </Badge>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-ink-muted">
              Registers are taken per class arm per day. A teacher can amend a register after
              saving it; every change is written to the audit log.
            </p>
            <Link
              href="/attendance"
              className="mt-3 inline-block text-sm font-medium text-accent underline underline-offset-2"
            >
              Take a register
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current term</CardTitle>
          </CardHeader>
          <CardBody>
            {term ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Session</dt>
                  <dd className="font-medium">{term.academic_session?.label}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Term</dt>
                  <dd className="font-medium">{term.label}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Runs</dt>
                  <dd className="font-medium tabular-nums">
                    {term.starts_on} – {term.ends_on}
                  </dd>
                </div>
              </dl>
            ) : (
              <EmptyState
                title="No current term"
                description="Set a current term in Settings before taking attendance or enrolling students."
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
