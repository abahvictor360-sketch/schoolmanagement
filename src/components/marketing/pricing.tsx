import type { BillingPlanRow } from '@/lib/database.types'

/**
 * The public price list. Bands come from the same table that bills a school,
 * so a quoted price is never a stale copy of the real one.
 */
export function PricingBands({
  plans,
  contact,
}: {
  plans: BillingPlanRow[]
  contact?: string
}) {
  const price = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount)

  const quote = contact ? (
    <a
      href={`mailto:${contact}?subject=${encodeURIComponent('SchoolHub pricing')}`}
      className="font-semibold text-accent-on-soft underline underline-offset-2"
    >
      Ask us for a quote
    </a>
  ) : null

  return (
    <div id="pricing" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-[26px] font-bold tracking-[-0.025em]">Priced by size, not by seat</h2>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
          A ninety-pupil nursery should not pay what a fourteen-hundred-pupil group pays. The band
          is worked out from your active roll and re-checked only when you renew, so admitting a
          pupil mid-term never changes the bill you are on. Pay yearly and two months are free.
        </p>

        {/* An empty grid under a pricing heading reads as a broken site, so the
            section still says something if that read ever fails. */}
        {plans.length === 0 ? (
          <div className="mt-8 rounded-[18px] bg-canvas p-5 text-[14px] text-ink-muted">
            Our current bands are not loading just now. {quote ?? 'Please try again shortly.'}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col rounded-[18px] bg-canvas p-5 shadow-[var(--shadow-card)]"
              >
                <p className="text-[15px] font-bold">{plan.name}</p>
                <p className="text-[13px] text-ink-muted">
                  {plan.max_students === null
                    ? 'No pupil ceiling'
                    : `Up to ${plan.max_students} pupils`}
                </p>
                <p className="mt-4 text-[26px] font-bold tracking-[-0.03em] tabular-nums">
                  {price(plan.monthly_amount, plan.currency)}
                </p>
                <p className="text-[12px] text-ink-muted">per month</p>
                <p className="mt-2 text-[13px] font-semibold text-accent-on-soft tabular-nums">
                  {price(plan.yearly_amount, plan.currency)} yearly
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-[13px] text-ink-muted">
          Every band includes every feature. There is no tier that withholds the audit log or locks
          your pupils out of their results.{' '}
          {contact ? (
            <a
              href={`mailto:${contact}?subject=${encodeURIComponent('SchoolHub for a group of schools')}`}
              className="font-semibold text-accent-on-soft underline underline-offset-2"
            >
              Ask about a group of schools
            </a>
          ) : null}
        </p>
      </div>
    </div>
  )
}
