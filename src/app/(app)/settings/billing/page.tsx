import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  bandFor, listCharges, listPlans, loadSubscription, platformProvider, STATE_COPY,
} from '@/lib/billing'
import { providerReadiness } from '@/lib/payments/providers'
import {
  Badge, Card, CardBody, CardHeader, CardTitle, DataTable, EmptyState,
  PageHeader, StatTile, Td, Th,
} from '@/components/ui/primitives'
import { PlanPicker } from '@/components/billing/plan-picker'
import { CancelSubscription } from '@/components/billing/cancel'

export const metadata: Metadata = { title: 'Subscription' }

const STATUS_TONE = {
  paid: 'positive', pending: 'warn', failed: 'warn', abandoned: 'neutral',
} as const

export default async function BillingSettingsPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const [subscription, plans, charges, roll] = await Promise.all([
    loadSubscription(ctx.school.id),
    listPlans(),
    listCharges(ctx.school.id),
    supabase.from('students').select('id', { count: 'exact', head: true })
      .eq('school_id', ctx.school.id).eq('status', 'active'),
  ])

  const pupils = roll.count ?? 0
  const band = bandFor(plans, pupils)
  const copy = STATE_COPY[subscription.state]

  // Whether the operator's own gateway is configured. Computed here so no
  // secret, nor its absence, is guessed at in the browser.
  const settings = platformProvider()
  const readiness = settings
    ? providerReadiness(settings)
    : { ready: false, reason: 'PLATFORM_BILLING_PROVIDER is not a provider this build knows.' }

  // The price list is in the plan's own currency, which is the operator's, not
  // the school's. Formatting it with the school's locale would be a lie.
  const price = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: band?.currency ?? 'NGN',
      maximumFractionDigits: 0,
    }).format(amount)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscription"
        description="What this school pays to use SchoolHub. Separate from the fees it charges parents."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Status" value={copy.label} tint={copy.tone === 'danger' ? 'peach' : 'violet'} />
        <StatTile label="Plan" value={subscription.plan?.name ?? band?.name ?? '—'} tint="sky" />
        <StatTile label="Active pupils" value={pupils} tint="mint" hint={band ? `${band.name} band` : undefined} />
        <StatTile
          label={subscription.state === 'trialing' ? 'Trial ends' : 'Renews'}
          value={subscription.row?.current_period_end ?? '—'}
          tint="peach"
          hint={
            subscription.daysLeft === null
              ? undefined
              : subscription.daysLeft >= 0
                ? `in ${subscription.daysLeft} day${subscription.daysLeft === 1 ? '' : 's'}`
                : `${-subscription.daysLeft} day${subscription.daysLeft === -1 ? '' : 's'} ago`
          }
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>{subscription.state === 'unbilled' ? 'Choose a plan' : 'Renew'}</CardTitle>
            {band ? <Badge tone="accent">{band.name}</Badge> : null}
          </CardHeader>
          <CardBody className="space-y-4">
            {band ? (
              <>
                <p className="text-sm text-ink-muted">
                  With {pupils} active pupil{pupils === 1 ? '' : 's'} this school is on the{' '}
                  <strong className="font-semibold text-ink">{band.name}</strong> band
                  {band.max_students === null
                    ? ', which has no pupil ceiling.'
                    : ` (up to ${band.max_students} pupils).`}{' '}
                  The band is re-checked every time you renew, so growing into the next one is
                  never a surprise mid-period.
                </p>
                <PlanPicker
                  plan={band}
                  disabled={!readiness.ready}
                  disabledReason={readiness.reason}
                />
              </>
            ) : (
              <EmptyState
                title="No plan available"
                description="No active plan covers a school this size. Contact the operator."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>All bands</CardTitle></CardHeader>
          <CardBody className="space-y-2.5">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`flex items-baseline justify-between gap-3 rounded-xl px-3 py-2 ${
                  plan.id === band?.id ? 'bg-accent-soft' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">{plan.name}</span>
                  <span className="block text-[12px] text-ink-muted">
                    {plan.max_students === null ? 'No ceiling' : `Up to ${plan.max_students} pupils`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-semibold tabular-nums">
                    {price(plan.monthly_amount)}
                  </span>
                  <span className="block text-[11px] text-ink-muted">per month</span>
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
          <Badge>{charges.length}</Badge>
        </CardHeader>
        {charges.length === 0 ? (
          <EmptyState
            title="Nothing charged yet"
            description="Subscription payments appear here once one has been started."
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Raised</Th>
                <Th>Period</Th>
                <Th className="hidden sm:table-cell">Pupils</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr key={charge.id}>
                  <Td className="tabular-nums">{charge.created_at.slice(0, 10)}</Td>
                  <Td className="tabular-nums">
                    {charge.period_start} – {charge.period_end}
                  </Td>
                  {/* The roll at the moment of billing, not today's. */}
                  <Td className="hidden tabular-nums sm:table-cell">{charge.student_count}</Td>
                  <Td className="text-right tabular-nums">
                    {new Intl.NumberFormat('en-NG', {
                      style: 'currency', currency: charge.currency, maximumFractionDigits: 0,
                    }).format(charge.amount)}
                  </Td>
                  <Td className="text-right">
                    <Badge tone={STATUS_TONE[charge.status]}>{charge.status}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      {subscription.row && !subscription.row.canceled_at ? (
        <Card>
          <CardHeader><CardTitle>Stop renewing</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-ink-muted">
              The school keeps everything it has paid for until{' '}
              <strong className="font-semibold text-ink">{subscription.row.current_period_end}</strong>,
              then {subscription.row.grace_days} days of grace, after which it becomes read only.
              Nothing is ever deleted.
            </p>
            <CancelSubscription />
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
