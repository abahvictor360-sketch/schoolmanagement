import { describe, expect, it } from 'vitest'
import { bandFor, deriveState, priceFor, type SubscriptionDates } from '@/lib/billing'
import type { BillingPlanRow } from '@/lib/database.types'

const day = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

const sub = (over: Partial<SubscriptionDates>): SubscriptionDates => ({
  current_period_end: day(30),
  trial_ends_on: null,
  grace_days: 7,
  canceled_at: null,
  ...over,
})

const plan = (over: Partial<BillingPlanRow>): BillingPlanRow => ({
  id: 'p', code: 'c', name: 'N', max_students: 200,
  monthly_amount: 100, yearly_amount: 1000, currency: 'NGN',
  sort_order: 1, is_active: true, created_at: '', ...over,
})

describe('deriveState', () => {
  it('treats a school with no subscription as unbilled, not lapsed', () => {
    // Schools that predate billing must keep working.
    expect(deriveState(null)).toBe('unbilled')
  })

  it('reads a live trial as trialing', () => {
    expect(deriveState(sub({ trial_ends_on: day(5) }))).toBe('trialing')
  })

  it('reads the last day of a trial as still trialing', () => {
    expect(deriveState(sub({ trial_ends_on: day(0) }))).toBe('trialing')
  })

  it('reads a paid period as active', () => {
    expect(deriveState(sub({ current_period_end: day(1) }))).toBe('active')
  })

  it('reads the final day of a period as active, not overdue', () => {
    expect(deriveState(sub({ current_period_end: day(0) }))).toBe('active')
  })

  it('reads the grace window as past_due', () => {
    expect(deriveState(sub({ current_period_end: day(-3) }))).toBe('past_due')
  })

  it('reads the last grace day as past_due', () => {
    expect(deriveState(sub({ current_period_end: day(-7), grace_days: 7 }))).toBe('past_due')
  })

  it('reads the day after grace as read_only', () => {
    expect(deriveState(sub({ current_period_end: day(-8), grace_days: 7 }))).toBe('read_only')
  })

  it('honours a grace of zero', () => {
    expect(deriveState(sub({ current_period_end: day(-1), grace_days: 0 }))).toBe('read_only')
  })

  it('keeps a cancelled school running until its period runs out', () => {
    // Cancelling is not a punishment: they paid for the time.
    expect(deriveState(sub({ canceled_at: '2026-01-01T00:00:00Z', current_period_end: day(10) })))
      .toBe('active')
  })

  it('reads a cancelled, expired school as canceled', () => {
    expect(deriveState(sub({ canceled_at: '2026-01-01T00:00:00Z', current_period_end: day(-1) })))
      .toBe('canceled')
  })

  it('lets a live trial outrank an expired period', () => {
    // set_school_subscription can grant a trial to a lapsed school; the trial
    // has to win, or the grant would do nothing.
    expect(deriveState(sub({ trial_ends_on: day(10), current_period_end: day(-40) })))
      .toBe('trialing')
  })
})

describe('bandFor', () => {
  const plans = [
    plan({ id: 'starter', name: 'Starter', max_students: 200, sort_order: 1 }),
    plan({ id: 'growth', name: 'Growth', max_students: 600, sort_order: 2 }),
    plan({ id: 'group', name: 'Group', max_students: null, sort_order: 4 }),
  ]

  it('puts a school on the cheapest band that still holds it', () => {
    expect(bandFor(plans, 0)?.id).toBe('starter')
    expect(bandFor(plans, 200)?.id).toBe('starter')
  })

  it('moves one pupil over a ceiling up to the next band', () => {
    expect(bandFor(plans, 201)?.id).toBe('growth')
  })

  it('falls through to the open-ended band for a very large school', () => {
    expect(bandFor(plans, 250_000)?.id).toBe('group')
  })

  it('returns null when no band has a ceiling high enough', () => {
    expect(bandFor([plan({ max_students: 10 })], 11)).toBeNull()
  })
})

describe('priceFor', () => {
  it('reads the amount off the interval the school chose', () => {
    const p = plan({ monthly_amount: 35_000, yearly_amount: 350_000 })
    expect(priceFor(p, 'monthly')).toBe(35_000)
    expect(priceFor(p, 'yearly')).toBe(350_000)
  })
})
