/**
 * One interface, four gateways. A school picks its provider in Settings; the
 * fee code below never names a provider directly.
 *
 * Secret keys come from the environment, one per provider, and are only ever
 * read on the server. The public key a school stores in the database is the
 * only credential that reaches the browser, which is all inline checkout needs.
 */

export const PROVIDERS = {
  paystack: {
    key: 'paystack',
    label: 'Paystack',
    blurb: 'Cards, bank transfer and USSD. Nigeria, Ghana, South Africa, Kenya.',
    secretEnv: 'PAYSTACK_SECRET_KEY',
    currencies: ['NGN', 'GHS', 'ZAR', 'KES', 'USD'],
    needsMerchantCode: false,
  },
  flutterwave: {
    key: 'flutterwave',
    label: 'Flutterwave',
    blurb: 'Cards, transfer, mobile money across much of Africa.',
    secretEnv: 'FLUTTERWAVE_SECRET_KEY',
    currencies: ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'ZAR', 'USD'],
    needsMerchantCode: false,
  },
  remita: {
    key: 'remita',
    label: 'Remita',
    blurb: 'Widely used by Nigerian institutions for direct bank collections.',
    secretEnv: 'REMITA_API_KEY',
    currencies: ['NGN'],
    needsMerchantCode: true,
  },
  stripe: {
    key: 'stripe',
    label: 'Stripe',
    blurb: 'International cards. Use for schools billing outside Africa.',
    secretEnv: 'STRIPE_SECRET_KEY',
    currencies: ['USD', 'GBP', 'EUR', 'ZAR'],
    needsMerchantCode: false,
  },
} as const

export type ProviderKey = keyof typeof PROVIDERS

export type ProviderSettings = {
  provider: ProviderKey
  is_enabled: boolean
  is_live: boolean
  public_key: string | null
  merchant_code: string | null
  service_type_id: string | null
}

export type InitResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string }

export type VerifyResult =
  | { ok: true; paid: boolean; amountMinor: number; providerReference: string; currency: string }
  | { ok: false; error: string }

export type ChargeRequest = {
  reference: string
  /** Major units, e.g. 1500.00 naira. Converted per provider below. */
  amount: number
  currency: string
  email: string
  callbackUrl: string
  payerName: string | null
  settings: ProviderSettings
}

/** Most gateways bill in minor units; a few currencies have no minor unit. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'UGX'])

export function toMinorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100)
}

export function fromMinorUnits(minor: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? minor : minor / 100
}

function secretFor(provider: ProviderKey): string | null {
  return process.env[PROVIDERS[provider].secretEnv] ?? null
}

/** Whether a provider is actually usable right now, and why not if it isn't. */
export function providerReadiness(settings: ProviderSettings): { ready: boolean; reason?: string } {
  const meta = PROVIDERS[settings.provider]
  if (!settings.is_enabled) return { ready: false, reason: 'Online payment is switched off for this school.' }
  if (!secretFor(settings.provider)) {
    return { ready: false, reason: `${meta.label} is selected but ${meta.secretEnv} is not set on the server.` }
  }
  if (!settings.public_key) {
    return { ready: false, reason: `${meta.label} is selected but its public key has not been entered.` }
  }
  if (meta.needsMerchantCode && !settings.merchant_code) {
    return { ready: false, reason: `${meta.label} needs a merchant code.` }
  }
  return { ready: true }
}

/* ------------------------------------------------------------------ init */

export async function initialiseCharge(req: ChargeRequest): Promise<InitResult> {
  const readiness = providerReadiness(req.settings)
  if (!readiness.ready) return { ok: false, error: readiness.reason! }

  const secret = secretFor(req.settings.provider)!
  const minor = toMinorUnits(req.amount, req.currency)

  try {
    switch (req.settings.provider) {
      case 'paystack':
        return await initPaystack(req, secret, minor)
      case 'flutterwave':
        return await initFlutterwave(req, secret)
      case 'stripe':
        return await initStripe(req, secret, minor)
      case 'remita':
        return await initRemita(req, secret)
    }
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : 'The payment gateway could not be reached.',
    }
  }
}

async function initPaystack(req: ChargeRequest, secret: string, minor: number): Promise<InitResult> {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      reference: req.reference,
      amount: minor,
      currency: req.currency,
      email: req.email,
      callback_url: req.callbackUrl,
      metadata: { payer_name: req.payerName },
    }),
  })
  const body = await res.json()
  if (!res.ok || !body?.status) {
    return { ok: false, error: body?.message || `Paystack refused the request (${res.status}).` }
  }
  return { ok: true, checkoutUrl: body.data.authorization_url }
}

async function initFlutterwave(req: ChargeRequest, secret: string): Promise<InitResult> {
  const res = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      tx_ref: req.reference,
      amount: req.amount,
      currency: req.currency,
      redirect_url: req.callbackUrl,
      customer: { email: req.email, name: req.payerName ?? undefined },
    }),
  })
  const body = await res.json()
  if (!res.ok || body?.status !== 'success') {
    return { ok: false, error: body?.message || `Flutterwave refused the request (${res.status}).` }
  }
  return { ok: true, checkoutUrl: body.data.link }
}

async function initStripe(req: ChargeRequest, secret: string, minor: number): Promise<InitResult> {
  // Stripe's form-encoded API, called directly so the SDK is not a dependency.
  const form = new URLSearchParams({
    mode: 'payment',
    client_reference_id: req.reference,
    success_url: `${req.callbackUrl}?reference=${encodeURIComponent(req.reference)}`,
    cancel_url: `${req.callbackUrl}?reference=${encodeURIComponent(req.reference)}&cancelled=1`,
    customer_email: req.email,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': req.currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(minor),
    'line_items[0][price_data][product_data][name]': 'School fees',
  })
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  const body = await res.json()
  if (!res.ok) {
    return { ok: false, error: body?.error?.message || `Stripe refused the request (${res.status}).` }
  }
  return { ok: true, checkoutUrl: body.url }
}

async function initRemita(req: ChargeRequest, secret: string): Promise<InitResult> {
  const { settings } = req
  const res = await fetch(
    'https://remitademo.net/remita/exapp/api/v1/send/api/echannelsvc/merchant/api/paymentinit',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `remitaConsumerKey=${settings.merchant_code},remitaConsumerToken=${secret}`,
      },
      body: JSON.stringify({
        serviceTypeId: settings.service_type_id,
        amount: String(req.amount),
        orderId: req.reference,
        payerName: req.payerName ?? 'Fee payer',
        payerEmail: req.email,
        description: 'School fees',
        responseurl: req.callbackUrl,
      }),
    },
  )
  const text = await res.text()
  // Remita answers with a JSONP-style wrapper on some endpoints.
  const json = JSON.parse(text.replace(/^jsonp\s*\(/, '').replace(/\)\s*$/, ''))
  if (json?.statuscode !== '025' && json?.status !== 'success') {
    return { ok: false, error: json?.statusMessage || 'Remita refused the request.' }
  }
  return {
    ok: true,
    checkoutUrl: `https://remitademo.net/remita/ecomm/finalize.reg?rrr=${json.RRR}`,
  }
}

/* ---------------------------------------------------------------- verify */

/**
 * Asks the gateway what really happened. This is the only authority on whether
 * money moved — never the redirect's query string, which the payer controls.
 */
export async function verifyCharge(
  provider: ProviderKey,
  reference: string,
): Promise<VerifyResult> {
  const secret = secretFor(provider)
  if (!secret) {
    return { ok: false, error: `${PROVIDERS[provider].secretEnv} is not set on the server.` }
  }

  try {
    switch (provider) {
      case 'paystack': {
        const res = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { authorization: `Bearer ${secret}` } },
        )
        const body = await res.json()
        if (!res.ok || !body?.status) {
          return { ok: false, error: body?.message || 'Paystack could not verify that reference.' }
        }
        return {
          ok: true,
          paid: body.data.status === 'success',
          amountMinor: body.data.amount,
          providerReference: String(body.data.id),
          currency: body.data.currency,
        }
      }
      case 'flutterwave': {
        const res = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
          { headers: { authorization: `Bearer ${secret}` } },
        )
        const body = await res.json()
        if (!res.ok || body?.status !== 'success') {
          return { ok: false, error: body?.message || 'Flutterwave could not verify that reference.' }
        }
        return {
          ok: true,
          paid: body.data.status === 'successful',
          amountMinor: toMinorUnits(Number(body.data.amount), body.data.currency),
          providerReference: String(body.data.id),
          currency: body.data.currency,
        }
      }
      case 'stripe': {
        const res = await fetch(
          `https://api.stripe.com/v1/checkout/sessions?client_reference_id=${encodeURIComponent(reference)}&limit=1`,
          { headers: { authorization: `Bearer ${secret}` } },
        )
        const body = await res.json()
        const session = body?.data?.[0]
        if (!res.ok || !session) {
          return { ok: false, error: body?.error?.message || 'Stripe has no session for that reference.' }
        }
        return {
          ok: true,
          paid: session.payment_status === 'paid',
          amountMinor: session.amount_total,
          providerReference: String(session.payment_intent ?? session.id),
          currency: String(session.currency).toUpperCase(),
        }
      }
      case 'remita': {
        const res = await fetch(
          `https://remitademo.net/remita/ecomm/${reference}/orderstatus.reg`,
          { headers: { Authorization: `remitaConsumerToken=${secret}` } },
        )
        const text = await res.text()
        const json = JSON.parse(text.replace(/^jsonp\s*\(/, '').replace(/\)\s*$/, ''))
        return {
          ok: true,
          paid: json?.status === '00' || json?.message === 'Approved',
          amountMinor: toMinorUnits(Number(json?.amount ?? 0), 'NGN'),
          providerReference: String(json?.RRR ?? reference),
          currency: 'NGN',
        }
      }
    }
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : 'The payment gateway could not be reached.',
    }
  }
}
