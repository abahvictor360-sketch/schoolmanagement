import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PROVIDERS, type ProviderKey } from '@/lib/payments/providers'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives'
import { PaymentSettingsForm } from '@/components/settings/payment-settings-form'
import type { SchoolPaymentSettingsRow } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Payments' }

export default async function PaymentSettingsPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const { data } = await supabase
    .from('school_payment_settings')
    .select('provider, is_enabled, is_live, public_key, merchant_code, service_type_id')
    .eq('school_id', ctx.school.id)
    .maybeSingle<SchoolPaymentSettingsRow>()

  // Computed on the server so no secret, nor its absence, is guessed at in the
  // browser. Only the boolean crosses over.
  const secretsPresent = Object.fromEntries(
    (Object.keys(PROVIDERS) as ProviderKey[]).map((key) => [
      key,
      Boolean(process.env[PROVIDERS[key].secretEnv]),
    ]),
  ) as Record<ProviderKey, boolean>

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <PaymentSettingsForm
        currency={ctx.config.currency}
        secretsPresent={secretsPresent}
        initial={{
          provider: data?.provider ?? 'paystack',
          is_enabled: data?.is_enabled ?? false,
          is_live: data?.is_live ?? false,
          public_key: data?.public_key ?? null,
          merchant_code: data?.merchant_code ?? null,
          service_type_id: data?.service_type_id ?? null,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>How a payment is trusted</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-[13px] text-ink-muted">
          <p>
            The amount is read from the invoice balance by the database, never taken from the
            browser, so a tampered form cannot change what is owed.
          </p>
          <p>
            When the payer returns, the gateway&rsquo;s own verify endpoint decides whether money
            moved. The redirect&rsquo;s query string is only a hint.
          </p>
          <p>
            Confirming the same reference twice credits the invoice once, so a payer refreshing
            the page and a bursar reconciling cannot double-count.
          </p>
          <p className="text-ink">
            Secret keys live in the server environment, one per provider. They are never stored
            against a school.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
