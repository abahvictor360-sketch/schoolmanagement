import { createClient } from '@/lib/supabase/server'
import { PROVIDERS, type ProviderKey, type ProviderSettings } from '@/lib/payments/providers'
import type {
  BillingChargeRow, BillingInterval, BillingPlanRow,
  SchoolSubscriptionRow, SubscriptionState,
} from '@/lib/database.types'

export type Subscription = {
  state: SubscriptionState
  plan: BillingPlanRow | null
  row: SchoolSubscriptionRow | null
  /** Negative once the period has ended. */
  daysLeft: number | null
  /** The last day writes are still allowed, grace included. */
  writesUntil: string | null
  permitsWrites: boolean
}

const WRITING: SubscriptionState[] = ['unbilled', 'trialing', 'active', 'past_due']

function dayDiff(iso: string): number {
  const then = Date.parse(`${iso}T00:00:00Z`)
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((then - today) / 86_400_000)
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The same derivation the database uses, recomputed here so a page can render
 * the banner without a second round trip. `app.subscription_state()` remains
 * the authority — this never decides whether a write is allowed, only what to
 * say about it.
 */
export type SubscriptionDates = Pick<
  SchoolSubscriptionRow,
  'current_period_end' | 'trial_ends_on' | 'grace_days' | 'canceled_at'
>

export function deriveState(row: SubscriptionDates | null): SubscriptionState {
  if (!row) return 'unbilled'
  const endsIn = dayDiff(row.current_period_end)
  if (row.canceled_at && endsIn < 0) return 'canceled'
  if (row.trial_ends_on && dayDiff(row.trial_ends_on) >= 0) return 'trialing'
  if (endsIn >= 0) return 'active'
  if (endsIn + row.grace_days >= 0) return 'past_due'
  return 'read_only'
}

export async function loadSubscription(schoolId: string): Promise<Subscription> {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('school_subscriptions')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle<SchoolSubscriptionRow>()

  let plan: BillingPlanRow | null = null
  if (row) {
    const { data } = await supabase
      .from('billing_plans').select('*').eq('id', row.plan_id).maybeSingle<BillingPlanRow>()
    plan = data
  }

  const state = deriveState(row)
  return {
    state,
    plan,
    row,
    daysLeft: row ? dayDiff(row.current_period_end) : null,
    writesUntil: row ? addDays(row.current_period_end, row.grace_days) : null,
    permitsWrites: WRITING.includes(state),
  }
}

export async function listPlans(): Promise<BillingPlanRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('billing_plans').select('*').eq('is_active', true)
    .order('sort_order').returns<BillingPlanRow[]>()
  return data ?? []
}

export async function listCharges(schoolId: string, limit = 12): Promise<BillingChargeRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('billing_charges').select('*').eq('school_id', schoolId)
    .order('created_at', { ascending: false }).limit(limit)
    .returns<BillingChargeRow[]>()
  return data ?? []
}

/** The cheapest band that still holds this many pupils. Mirrors app.plan_for_student_count(). */
export function bandFor(plans: BillingPlanRow[], pupils: number): BillingPlanRow | null {
  return plans.find((p) => p.max_students === null || p.max_students >= pupils) ?? null
}

export function priceFor(plan: BillingPlanRow, interval: BillingInterval): number {
  return interval === 'monthly' ? plan.monthly_amount : plan.yearly_amount
}

/**
 * The platform's own merchant account. Subscription money goes to the operator,
 * not to the school, so this does not read school_payment_settings — it is
 * configured once, in the environment, for the whole deployment.
 */
export function platformProvider(): ProviderSettings | null {
  const key = (process.env.PLATFORM_BILLING_PROVIDER ?? 'paystack') as ProviderKey
  if (!(key in PROVIDERS)) return null
  return {
    provider: key,
    is_enabled: true,
    is_live: process.env.NODE_ENV === 'production',
    public_key: process.env.PLATFORM_BILLING_PUBLIC_KEY ?? null,
    merchant_code: process.env.PLATFORM_BILLING_MERCHANT_CODE ?? null,
    service_type_id: process.env.PLATFORM_BILLING_SERVICE_TYPE_ID ?? null,
  }
}

export const STATE_COPY: Record<SubscriptionState, { label: string; tone: 'positive' | 'warn' | 'danger' | 'neutral' }> = {
  unbilled:  { label: 'Not billed',  tone: 'neutral'  },
  trialing:  { label: 'Free trial',  tone: 'positive' },
  active:    { label: 'Active',      tone: 'positive' },
  past_due:  { label: 'Payment due', tone: 'warn'     },
  read_only: { label: 'Read only',   tone: 'danger'   },
  canceled:  { label: 'Cancelled',   tone: 'danger'   },
}
