import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarCheck, GraduationCap, UserSquare2, Users } from 'lucide-react'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { money } from '@/lib/money'
import {
  Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, StatTile,
} from '@/components/ui/primitives'
import type { InvoiceBalanceRow } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const ctx = await requireSchool()
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

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

  const [students, staff, arms, enrolled, registersToday, balances] = await Promise.all([
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
      .eq('school_id', ctx.school.id).eq('register_date', today),
    supabase.from('invoice_balances').select('total_amount, amount_paid, balance')
      .eq('school_id', ctx.school.id)
      .returns<Pick<InvoiceBalanceRow, 'total_amount' | 'amount_paid' | 'balance'>[]>(),
  ])

  const rows = balances.data ?? []
  const collected = rows.reduce((sum, r) => sum + Number(r.amount_paid), 0)
  const outstanding = rows.reduce((sum, r) => sum + Number(r.balance), 0)
  const billed = rows.reduce((sum, r) => sum + Number(r.total_amount), 0)
  const collectionRate = billed === 0 ? null : Math.round((collected / billed) * 100)

  const armsCount = arms.count ?? 0
  const takenToday = registersToday.count ?? 0
  const attendancePct = armsCount === 0 ? 0 : Math.round((takenToday / armsCount) * 100)

  const canSeeFees = ['school_admin', 'bursar'].includes(ctx.role) || ctx.isPlatformAdmin

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.03em]">
          Welcome, {ctx.fullName.split(' ')[0] ?? ''}.
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {term
            ? `${term.academic_session?.label ?? ''} · ${term.label} · runs to ${term.ends_on}`
            : 'No current term is set yet.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Students"
          value={students.count ?? 0}
          tint="violet"
          icon={GraduationCap}
          hint={`${enrolled.count ?? 0} enrolled`}
        />
        <StatTile label="Staff" value={staff.count ?? 0} tint="mint" icon={UserSquare2} />
        <StatTile label="Class arms" value={armsCount} tint="sky" icon={Users} />
        <StatTile
          label="Registers today"
          value={`${takenToday}/${armsCount}`}
          tint="peach"
          icon={CalendarCheck}
          hint={`${attendancePct}% taken`}
        />
      </div>

      {canSeeFees && rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Fee collection</CardTitle>
            <div className="flex items-center gap-2">
              <Badge tone={collectionRate !== null && collectionRate >= 70 ? 'positive' : 'warn'}>
                {collectionRate ?? 0}% collected
              </Badge>
              <Link
                href="/fees"
                className="text-[13px] font-semibold text-accent underline underline-offset-2"
              >
                Open
              </Link>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Billed" value={money(ctx.config, billed)} tint="violet" />
              <StatTile label="Collected" value={money(ctx.config, collected)} tint="mint" />
              <StatTile label="Outstanding" value={money(ctx.config, outstanding)} tint="peach" />
            </div>

            {/* A single honest bar: what has come in against what was billed. */}
            <div>
              <div
                role="img"
                aria-label={`${collectionRate ?? 0}% of fees billed have been collected`}
                className="h-3 w-full overflow-hidden rounded-full bg-canvas"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${Math.min(100, collectionRate ?? 0)}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] text-ink-muted">
                {rows.filter((r) => Number(r.balance) <= 0).length} of {rows.length} invoices
                settled.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance today</CardTitle>
            <Badge tone={takenToday > 0 ? 'positive' : 'warn'}>
              {takenToday} of {armsCount}
            </Badge>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-ink-muted">
              Registers are taken per class arm per day. A teacher can amend a register after
              saving it, and every change is written to the audit log.
            </p>
            <Link
              href="/attendance"
              className="mt-3 inline-block text-sm font-semibold text-accent underline underline-offset-2"
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
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Session</dt>
                  <dd className="font-semibold">{term.academic_session?.label}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Term</dt>
                  <dd className="font-semibold">{term.label}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Runs</dt>
                  <dd className="font-semibold tabular-nums">
                    {term.starts_on} – {term.ends_on}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Grading</dt>
                  <dd className="font-semibold">
                    {ctx.config.assessment_components.map((c) => `${c.weight}`).join('/')} ·{' '}
                    pass {ctx.config.pass_mark}%
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
