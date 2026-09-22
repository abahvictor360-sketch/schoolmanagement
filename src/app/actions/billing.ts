'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireRole, requirePlatformAdmin, requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  describeDbError, failed, parse, succeeded, type ActionResult,
} from '@/lib/action-result'

import { platformProvider } from '@/lib/billing'
import { initialiseCharge, providerReadiness, verifyCharge, type ProviderKey } from '@/lib/payments/providers'
import { subscriptionCheckoutSchema, setSchoolPlanSchema } from '@/lib/validation'

type Checkout = { reference: string; amount: number; currency: string; plan: string }

/**
 * Open a subscription payment. The amount is never sent from the browser: the
 * database picks the band from the pupil roll and returns what to collect.
 */
export async function startSubscriptionPayment(
  input: unknown,
): Promise<ActionResult<{ checkoutUrl: string; reference: string }>> {
  const parsed = parse(subscriptionCheckoutSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await requireRole('school_admin')

  const settings = platformProvider()
  if (!settings) return failed('PLATFORM_BILLING_PROVIDER is not a provider this build knows.')
  const readiness = providerReadiness(settings)
  if (!readiness.ready) return failed(readiness.reason!)

  const supabase = await createClient()
  const opened = await supabase.rpc('start_subscription_checkout', {
    target_school: ctx.school.id,
    chosen_interval: parsed.value.interval,
  })
  if (opened.error) return failed(describeDbError(opened.error))

  const charge = opened.data as unknown as Checkout
  const host = (await headers()).get('host')
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'

  const init = await initialiseCharge({
    reference: charge.reference,
    amount: Number(charge.amount),
    currency: charge.currency,
    email: ctx.email,
    callbackUrl: `${proto}://${host}/settings/billing/verify`,
    payerName: ctx.fullName,
    settings,
  })

  if (!init.ok) {
    // Do not leave a pending charge behind for a checkout that never opened.
    await supabase.rpc('abandon_subscription_charge', { charge_reference: charge.reference })
    return failed(init.error)
  }

  return succeeded({ checkoutUrl: init.checkoutUrl, reference: charge.reference })
}

/**
 * Settle a subscription payment. The gateway is asked directly whether the
 * money arrived — the browser's word for it is not evidence. The database
 * function is idempotent, so a repeated callback cannot buy a second period.
 */
export async function verifySubscriptionPayment(
  reference: string,
): Promise<ActionResult<{ state: string; alreadyPaid: boolean }>> {
  if (typeof reference !== 'string' || !reference.startsWith('sub_')) {
    return failed('That is not a subscription payment reference.')
  }
  await requireRole('school_admin')

  const settings = platformProvider()
  if (!settings) return failed('Online payment is not configured on this server.')

  const check = await verifyCharge(settings.provider as ProviderKey, reference)
  if (!check.ok) return failed(check.error)
  if (!check.paid) return failed('The gateway has not recorded this payment as successful.')

  const supabase = await createClient()
  const done = await supabase.rpc('confirm_subscription_payment', {
    charge_reference: reference,
    paid_provider: settings.provider,
  })
  if (done.error) return failed(describeDbError(done.error))

  const result = done.data as unknown as { state: string; already_paid: boolean }
  revalidatePath('/settings/billing')
  revalidatePath('/dashboard')
  return succeeded({ state: result.state, alreadyPaid: result.already_paid })
}

/** Stop renewing. The school keeps what it has already paid for. */
export async function cancelSubscription(): Promise<ActionResult> {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_subscription', { target_school: ctx.school.id })
  if (error) return failed(describeDbError(error))
  revalidatePath('/settings/billing')
  return succeeded()
}

/** Platform admin: move a school onto a plan, extend it, or grant a trial. */
export async function setSchoolPlan(input: unknown): Promise<ActionResult> {
  const parsed = parse(setSchoolPlanSchema, input)
  if (!parsed.ok) return parsed.result
  await requirePlatformAdmin()

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_school_subscription', {
    target_school: parsed.value.school_id,
    plan_code: parsed.value.plan_code,
    chosen_interval: parsed.value.interval,
    period_end: parsed.value.period_end ?? null,
    trial_ends: parsed.value.trial_ends ?? null,
  })
  if (error) return failed(describeDbError(error))
  revalidatePath('/platform')
  return succeeded()
}

/** What the current school would pay, for the settings page's live preview. */
export async function currentBand(): Promise<ActionResult<{ pupils: number }>> {
  const ctx = await requireSchool()
  const supabase = await createClient()
  const { count } = await supabase
    .from('students').select('id', { count: 'exact', head: true })
    .eq('school_id', ctx.school.id).eq('status', 'active')
  return succeeded({ pupils: count ?? 0 })
}
