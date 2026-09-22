import type { Metadata } from 'next'
import Link from 'next/link'
import { requireStudent } from '@/lib/student'
import { createClient } from '@/lib/supabase/server'
import { CalendarCheck, ClipboardList, PenSquare, TrendingUp } from 'lucide-react'
import {
  Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, StatTile,
} from '@/components/ui/primitives'
import { money } from '@/lib/money'
import { PROVIDERS, type ProviderKey } from '@/lib/payments/providers'
import { FeesCallout } from '@/components/portal/fees-callout'
import type {
  AttendanceStatus, InvoiceBalanceRow, SchoolPaymentSettingsRow,
} from '@/lib/database.types'

export const metadata: Metadata = { title: 'Home' }

export default async function PortalHome() {
  const ctx = await requireStudent()
  const supabase = await createClient()

  if (!ctx.enrollment) {
    return (
      <Card>
        <EmptyState
          title="You are not enrolled this term"
          description="Your school has not placed you in a class for the current term yet. Ask the school office if you think this is wrong."
        />
      </Card>
    )
  }

  const [
    { data: marks }, { data: results }, { data: openTests }, { data: unread },
    { data: balances }, { data: settings },
  ] = await Promise.all([
      supabase
        .from('attendance_entries')
        .select('status')
        .eq('enrollment_id', ctx.enrollment.id)
        .returns<{ status: AttendanceStatus }[]>(),
      supabase.rpc('result_sheet', { p_enrollment: ctx.enrollment.id }),
      supabase
        .from('cbt_tests')
        .select('id, title, closes_at')
        .eq('status', 'published')
        .lte('opens_at', new Date().toISOString())
        .gte('closes_at', new Date().toISOString())
        .order('closes_at'),
      supabase
        .from('thread_participants')
        .select('thread_id, last_read_at')
        .eq('user_id', ctx.userId),
      supabase
        .from('invoice_balances')
        .select('invoice_id, balance, due_on')
        .eq('enrollment_id', ctx.enrollment.id)
        // Explicit, because the callout below pays "the oldest one first".
        .order('due_on', { ascending: true, nullsFirst: false })
        .returns<Pick<InvoiceBalanceRow, 'invoice_id' | 'balance' | 'due_on'>[]>(),
      supabase
        .from('school_payment_settings')
        .select('provider, is_enabled, is_live, public_key, merchant_code, service_type_id')
        .eq('school_id', ctx.school.id)
        .maybeSingle<SchoolPaymentSettingsRow>(),
    ])

  const present = (marks ?? []).filter((m) => m.status === 'present' || m.status === 'late').length
  const total = marks?.length ?? 0
  const rate = total === 0 ? null : Math.round((present / total) * 100)

  const invoices = balances ?? []
  const outstanding = invoices.reduce((sum, b) => sum + Number(b.balance), 0)
  // Ordered by due date above, so this is the one due soonest.
  const openInvoice = invoices.find((b) => Number(b.balance) > 0) ?? null
  const providerKey = (settings?.provider ?? 'paystack') as ProviderKey
  const canPayOnline = Boolean(settings?.is_enabled && settings?.public_key)

  const graded = results ?? []
  const average =
    graded.length === 0
      ? null
      : Math.round(graded.reduce((sum, r) => sum + Number(r.percentage ?? 0), 0) / graded.length)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">
          Hello, {ctx.student.first_name}
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {ctx.enrollment.class_label} · {ctx.enrollment.session_label} {ctx.enrollment.term_label}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Attendance"
          value={rate === null ? '—' : `${rate}%`}
          tint="mint"
          icon={CalendarCheck}
        />
        <StatTile
          label="Subjects graded"
          value={graded.length}
          tint="violet"
          icon={ClipboardList}
        />
        <StatTile
          label="Average"
          value={average === null ? '—' : `${average}%`}
          tint="sky"
          icon={TrendingUp}
        />
        <StatTile
          label="Open tests"
          value={openTests?.length ?? 0}
          tint="peach"
          icon={PenSquare}
        />
      </div>

      {/* Money first: it is what a family opens this portal for. */}
      <FeesCallout
        outstanding={outstanding}
        formatted={money(ctx.config, outstanding)}
        invoiceId={openInvoice?.invoice_id ?? null}
        canPayOnline={canPayOnline}
        providerLabel={PROVIDERS[providerKey].label}
        dueOn={openInvoice?.due_on ?? null}
      />

      {openTests && openTests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tests open now</CardTitle>
            <Badge tone="warn">{openTests.length}</Badge>
          </CardHeader>
          <CardBody className="space-y-2">
            {openTests.map((t) => (
              <Link
                key={t.id}
                href={`/portal/tests/${t.id}`}
                className="flex min-h-[56px] items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 hover:border-accent/40 hover:bg-accent-soft/30"
              >
                <span className="text-sm font-medium">{t.title}</span>
                <span className="text-[12px] text-ink-muted">
                  closes {new Date(t.closes_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent results</CardTitle>
            <Link href="/portal/results" className="text-[13px] font-medium text-accent-on-soft underline underline-offset-2">
              See all
            </Link>
          </CardHeader>
          {graded.length === 0 ? (
            <EmptyState
              title="No results yet"
              description="Results appear here once your teachers publish them."
            />
          ) : (
            <CardBody className="space-y-2">
              {graded.slice(0, 5).map((r) => (
                <div key={r.subject_id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{r.subject_name}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-ink-muted">{r.percentage}%</span>
                    <Badge tone={r.is_pass ? 'positive' : 'danger'}>{r.grade_label}</Badge>
                  </span>
                </div>
              ))}
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <Link href="/portal/messages" className="text-[13px] font-medium text-accent-on-soft underline underline-offset-2">
              Open
            </Link>
          </CardHeader>
          <CardBody className="text-sm text-ink-muted">
            You have {unread?.length ?? 0} conversation{unread?.length === 1 ? '' : 's'} with your
            teachers. You can only message staff at your school.
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
