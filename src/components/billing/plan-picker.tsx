'use client'

import { useState, useTransition } from 'react'
import { startSubscriptionPayment } from '@/app/actions/billing'
import { Button } from '@/components/ui/primitives'
import type { BillingInterval, BillingPlanRow } from '@/lib/database.types'

/**
 * Monthly or yearly, then pay. The amount shown here is the same one the
 * database will price the charge at, but it is display only — the server never
 * takes a price from this form.
 */
export function PlanPicker({
  plan,
  disabled,
  disabledReason,
}: {
  plan: BillingPlanRow
  disabled: boolean
  disabledReason?: string
}) {
  // Formatted here rather than taking a formatter prop: a function cannot
  // cross the server/client boundary, and this page is dynamic, so that
  // mistake surfaces as a runtime error rather than a build failure.
  const money = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: plan.currency,
      maximumFractionDigits: 0,
    }).format(amount)

  const [interval, setInterval] = useState<BillingInterval>('yearly')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const monthsFree = Math.round(12 - plan.yearly_amount / plan.monthly_amount)

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium">Billing period</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['monthly', 'yearly'] as const).map((option) => {
            const amount = option === 'monthly' ? plan.monthly_amount : plan.yearly_amount
            const chosen = interval === option
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 transition-colors ${
                  chosen ? 'bg-accent-soft' : 'bg-canvas hover:bg-accent-soft/60'
                }`}
              >
                <input
                  type="radio"
                  name="interval"
                  value={option}
                  checked={chosen}
                  onChange={() => setInterval(option)}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold capitalize">{option}</span>
                  <span className="block text-lg font-bold tracking-[-0.02em] tabular-nums">
                    {money(amount)}
                  </span>
                  {option === 'yearly' && monthsFree > 0 ? (
                    <span className="block text-[12px] text-ink-muted">
                      {monthsFree} month{monthsFree === 1 ? '' : 's'} free against monthly
                    </span>
                  ) : null}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            setError(null)
            const result = await startSubscriptionPayment({ interval })
            if (!result.ok) {
              setError(result.error)
              return
            }
            window.location.href = result.data!.checkoutUrl
          })
        }
      >
        {pending ? 'Opening checkout…' : `Pay ${interval === 'monthly' ? 'monthly' : 'yearly'}`}
      </Button>

      {disabled && disabledReason ? (
        <p className="text-[12px] text-ink-muted">{disabledReason}</p>
      ) : null}
    </div>
  )
}
