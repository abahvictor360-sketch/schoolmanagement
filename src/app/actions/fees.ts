'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { requireRole, requireSchool } from '@/lib/auth'
import { describeDbError, failed, parse, succeeded, type ActionResult } from '@/lib/action-result'
import {
  brandColorSchema, feeStructureSchema, offlinePaymentSchema, paymentSettingsSchema,
  startPaymentSchema,
} from '@/lib/validation'
import {
  fromMinorUnits, initialiseCharge, PROVIDERS, providerReadiness, toMinorUnits,
  verifyCharge, type ProviderKey, type ProviderSettings,
} from '@/lib/payments/providers'

async function feeStaff() {
  const ctx = await requireSchool()
  if (!['school_admin', 'bursar'].includes(ctx.role) && !ctx.isPlatformAdmin) return null
  return ctx
}

/* ------------------------------------------------------- fee structures */

export async function createFeeStructure(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(feeStructureSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await feeStaff()
  if (!ctx) return failed('Only a bursar or administrator may set fees.')

  const supabase = await createClient()
  const structure = await supabase
    .from('fee_structures')
    .insert({
      school_id: ctx.school.id,
      term_id: parsed.value.term_id,
      class_level_id: parsed.value.class_level_id,
      name: parsed.value.name,
    })
    .select('id')
    .single()
  if (structure.error) return failed(describeDbError(structure.error))

  const items = await supabase.from('fee_items').insert(
    parsed.value.items.map((item, index) => ({
      school_id: ctx.school.id,
      fee_structure_id: structure.data.id,
      label: item.label,
      amount: item.amount,
      is_optional: item.is_optional,
      ordinal: index + 1,
    })),
  )
  if (items.error) return failed(describeDbError(items.error))

  revalidatePath('/fees')
  return succeeded({ id: structure.data.id })
}

export async function raiseInvoices(
  feeStructureId: string,
  dueOn: string,
): Promise<ActionResult<{ created: number }>> {
  const ctx = await feeStaff()
  if (!ctx) return failed('Only a bursar or administrator may raise invoices.')

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_invoices', {
    p_school_id: ctx.school.id,
    p_fee_structure_id: feeStructureId,
    p_due_on: dueOn || null,
  })
  if (error) return failed(describeDbError(error))

  revalidatePath('/fees')
  return succeeded({ created: data ?? 0 })
}

export async function recordOfflinePayment(input: unknown): Promise<ActionResult> {
  const parsed = parse(offlinePaymentSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await feeStaff()
  if (!ctx) return failed('Only a bursar or administrator may record a payment.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('record_offline_payment', {
    p_invoice_id: parsed.value.invoice_id,
    p_amount: parsed.value.amount,
    p_method: parsed.value.method,
    p_payer_kind: parsed.value.payer_kind,
    p_payer_guardian_id: parsed.value.payer_guardian_id,
    p_payer_name: parsed.value.payer_name,
    p_note: parsed.value.note,
  })
  if (error) return failed(describeDbError(error))

  revalidatePath('/fees')
  revalidatePath('/portal/fees')
  return succeeded()
}

/* ---------------------------------------------------- provider settings */

export async function savePaymentSettings(input: unknown): Promise<ActionResult> {
  const parsed = parse(paymentSettingsSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await feeStaff()
  if (!ctx) return failed('Only a bursar or administrator may change payment settings.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('school_payment_settings')
    .upsert({ school_id: ctx.school.id, ...parsed.value }, { onConflict: 'school_id' })
  if (error) return failed(describeDbError(error))

  revalidatePath('/settings/payments')
  revalidatePath('/portal/fees')
  return succeeded()
}

/* -------------------------------------------------------- paying a fee */

async function loadSettings(schoolId: string): Promise<ProviderSettings | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('school_payment_settings')
    .select('provider, is_enabled, is_live, public_key, merchant_code, service_type_id')
    .eq('school_id', schoolId)
    .maybeSingle<ProviderSettings>()
  return data
}

/**
 * Opens a payment and hands back the gateway's checkout URL.
 *
 * The amount is set by the database from the outstanding balance, not by the
 * caller, and the reference we generate is what the gateway echoes back. The
 * browser never sees a secret key.
 */
export async function startPayment(
  input: unknown,
): Promise<ActionResult<{ checkoutUrl: string; reference: string }>> {
  const parsed = parse(startPaymentSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await requireSchool()
  const settings = await loadSettings(ctx.school.id)
  if (!settings) return failed('This school has not set up online payment yet.')

  const readiness = providerReadiness(settings)
  if (!readiness.ready) return failed(readiness.reason!)

  const supabase = await createClient()
  const opened = await supabase.rpc('begin_card_payment', {
    p_invoice_id: parsed.value.invoice_id,
    p_amount: parsed.value.amount ?? undefined,
    p_payer_kind: parsed.value.payer_kind,
    p_payer_guardian_id: parsed.value.payer_guardian_id,
    p_payer_name: parsed.value.payer_name,
  })
  if (opened.error) return failed(describeDbError(opened.error))

  const { reference, amount } = opened.data as { reference: string; amount: number }

  const host = (await headers()).get('host')
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const callbackUrl = `${proto}://${host}/portal/fees/verify`

  const init = await initialiseCharge({
    reference,
    amount: Number(amount),
    currency: ctx.config.currency,
    email: ctx.email,
    callbackUrl,
    payerName: parsed.value.payer_name ?? ctx.fullName,
    settings,
  })

  if (!init.ok) {
    // Do not leave a pending row behind for a charge that never opened.
    await supabase.rpc('fail_card_payment', { p_reference: reference, p_note: init.error })
    return failed(init.error)
  }

  return succeeded({ checkoutUrl: init.checkoutUrl, reference })
}

/**
 * Settles a payment after the gateway sends the payer back. The redirect's
 * query string is treated as a hint only: the gateway's own verify endpoint
 * decides whether money moved, and the amount it reports is what gets recorded.
 */
export async function verifyPayment(
  reference: string,
): Promise<ActionResult<{ paid: boolean; amount: number; message: string }>> {
  const ctx = await requireSchool()
  const settings = await loadSettings(ctx.school.id)
  if (!settings) return failed('This school has not set up online payment.')

  const supabase = await createClient()

  // RLS confines this to a payment the caller is entitled to see.
  const { data: payment } = await supabase
    .from('payments')
    .select('reference, amount, status, provider')
    .eq('reference', reference)
    .maybeSingle<{ reference: string; amount: number; status: string; provider: string | null }>()

  if (!payment) return failed('That payment reference does not belong to you.')
  if (payment.status === 'confirmed') {
    return succeeded({ paid: true, amount: Number(payment.amount), message: 'Already recorded.' })
  }

  const provider = (payment.provider ?? settings.provider) as ProviderKey
  const verified = await verifyCharge(provider, reference)
  if (!verified.ok) return failed(verified.error)

  if (!verified.paid) {
    await supabase.rpc('fail_card_payment', {
      p_reference: reference,
      p_note: `${PROVIDERS[provider].label} reported the payment as not successful.`,
    })
    revalidatePath('/portal/fees')
    return succeeded({
      paid: false,
      amount: 0,
      message: 'The gateway did not confirm that payment. Nothing has been charged to your account.',
    })
  }

  const paidMajor = fromMinorUnits(verified.amountMinor, verified.currency)

  // If the gateway collected less than we opened, record what it collected.
  const confirmed = await supabase.rpc('confirm_card_payment', {
    p_reference: reference,
    p_provider_reference: verified.providerReference,
    p_amount_paid: paidMajor,
  })
  if (confirmed.error) return failed(describeDbError(confirmed.error))

  revalidatePath('/portal/fees')
  revalidatePath('/fees')
  return succeeded({ paid: true, amount: paidMajor, message: 'Payment received.' })
}

/** A bursar settling a payment whose payer never came back to the app. */
export async function reconcilePayment(reference: string): Promise<ActionResult<{ message: string }>> {
  const ctx = await feeStaff()
  if (!ctx) return failed('Only a bursar or administrator may reconcile a payment.')
  const result = await verifyPayment(reference)
  if (!result.ok) return result
  revalidatePath('/fees')
  return succeeded({ message: result.data!.message })
}

/* -------------------------------------------------------------- branding */

/** Signs an upload scoped to this school's own folder in the logo bucket. */
export async function logoUploadTarget(extension: string) {
  const ctx = await requireRole('school_admin')
  const safe = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(extension.toLowerCase())
    ? extension.toLowerCase()
    : 'png'
  const path = `${ctx.school.id}/logo.${safe}`

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('school-logos')
    .createSignedUploadUrl(path, { upsert: true })
  if (error) return failed(error.message)
  return succeeded({ path, token: data.token })
}

/**
 * Points the school at its uploaded logo. Storing the resolved public URL means
 * every surface that already reads schools.logo_url — sidebar, report card,
 * invoice — picks it up with no further work.
 */
export async function setSchoolLogo(path: string): Promise<ActionResult> {
  const ctx = await requireRole('school_admin')
  if (!path.startsWith(`${ctx.school.id}/`)) return failed('Invalid logo path.')

  const supabase = await createClient()
  const { data } = supabase.storage.from('school-logos').getPublicUrl(path)

  // A cache-busting suffix, so replacing a logo shows the new one immediately.
  const url = `${data.publicUrl}?v=${Date.now()}`

  const { error } = await supabase.from('schools').update({ logo_url: url }).eq('id', ctx.school.id)
  if (error) return failed(describeDbError(error))

  revalidatePath('/', 'layout')
  return succeeded()
}

/**
 * Sets the school's colour. Validated as a hex here and again by a check
 * constraint in the database, because it is rendered into a style attribute.
 */
export async function setBrandColor(input: unknown): Promise<ActionResult> {
  const parsed = parse(brandColorSchema, input)
  if (!parsed.ok) return parsed.result

  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase
    .from('schools')
    .update({ brand_color: parsed.value.brand_color })
    .eq('id', ctx.school.id)
  if (error) return failed(describeDbError(error))

  revalidatePath('/', 'layout')
  return succeeded()
}

export async function clearSchoolLogo(): Promise<ActionResult> {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { error } = await supabase.from('schools').update({ logo_url: null }).eq('id', ctx.school.id)
  if (error) return failed(describeDbError(error))
  revalidatePath('/', 'layout')
  return succeeded()
}
