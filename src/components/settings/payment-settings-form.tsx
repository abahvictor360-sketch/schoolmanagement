'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { savePaymentSettings } from '@/app/actions/fees'
import { useAction } from '@/lib/use-action'
import { cn } from '@/lib/utils'
import { PROVIDERS, type ProviderKey } from '@/lib/payments/providers'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input,
} from '@/components/ui/primitives'

export function PaymentSettingsForm({
  initial,
  currency,
  secretsPresent,
}: {
  initial: {
    provider: ProviderKey
    is_enabled: boolean
    is_live: boolean
    public_key: string | null
    merchant_code: string | null
    service_type_id: string | null
  }
  currency: string
  /** Which providers have their secret key configured on the server. */
  secretsPresent: Record<ProviderKey, boolean>
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    provider: initial.provider,
    is_enabled: initial.is_enabled,
    is_live: initial.is_live,
    public_key: initial.public_key ?? '',
    merchant_code: initial.merchant_code ?? '',
    service_type_id: initial.service_type_id ?? '',
  })
  const [saved, setSaved] = useState(false)

  const action = useAction(async () => savePaymentSettings(form), {
    onSuccess: () => {
      setSaved(true)
      router.refresh()
    },
  })

  const meta = PROVIDERS[form.provider]
  // `currencies` is a readonly literal tuple, so widen before testing membership.
  const currencySupported = (meta.currencies as readonly string[]).includes(currency.toUpperCase())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment gateway</CardTitle>
        <Badge tone={form.is_enabled ? 'positive' : 'neutral'}>
          {form.is_enabled ? 'Accepting payments' : 'Switched off'}
        </Badge>
      </CardHeader>

      <CardBody className="space-y-5">
        {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
        {saved && !action.pending ? <p className="text-sm text-positive">Saved.</p> : null}

        <fieldset className="space-y-2">
          <legend className="text-[13px] font-semibold">Choose a provider</legend>
          {(Object.keys(PROVIDERS) as ProviderKey[]).map((key) => {
            const p = PROVIDERS[key]
            const on = form.provider === key
            return (
              <label
                key={key}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-2xl p-3 transition-colors',
                  on ? 'bg-accent-soft ring-1 ring-accent/30' : 'bg-canvas hover:bg-accent-soft/50',
                )}
              >
                <input
                  type="radio"
                  name="provider"
                  className="mt-1"
                  checked={on}
                  onChange={() => {
                    setSaved(false)
                    setForm((f) => ({ ...f, provider: key }))
                  }}
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{p.label}</span>
                    {secretsPresent[key] ? (
                      <Badge tone="positive">Server key set</Badge>
                    ) : (
                      <Badge tone="warn">{p.secretEnv} missing</Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-ink-muted">{p.blurb}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-muted">
                    Currencies: {(p.currencies as readonly string[]).join(', ')}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>

        {!currencySupported ? (
          <ErrorNote>
            This school bills in {currency}, which {meta.label} does not list as supported. Change
            the currency in Academic rules, or pick another provider.
          </ErrorNote>
        ) : null}

        <Field
          label={`${meta.label} public key`}
          error={action.fieldErrors.public_key?.[0]}
          hint="Safe to store: inline checkout puts this in the browser by design. The secret key belongs in the server environment, never here."
        >
          <Input
            value={form.public_key}
            onChange={(e) => { setSaved(false); setForm((f) => ({ ...f, public_key: e.target.value })) }}
            placeholder={form.provider === 'stripe' ? 'pk_live_…' : 'pk_…'}
          />
        </Field>

        {meta.needsMerchantCode ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Merchant code" error={action.fieldErrors.merchant_code?.[0]}>
              <Input
                value={form.merchant_code}
                onChange={(e) => { setSaved(false); setForm((f) => ({ ...f, merchant_code: e.target.value })) }}
              />
            </Field>
            <Field label="Service type ID" error={action.fieldErrors.service_type_id?.[0]}>
              <Input
                value={form.service_type_id}
                onChange={(e) => { setSaved(false); setForm((f) => ({ ...f, service_type_id: e.target.value })) }}
              />
            </Field>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={form.is_enabled}
              onChange={(e) => { setSaved(false); setForm((f) => ({ ...f, is_enabled: e.target.checked })) }}
            />
            Let pupils pay fees online
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={form.is_live}
              onChange={(e) => { setSaved(false); setForm((f) => ({ ...f, is_live: e.target.checked })) }}
            />
            These are live keys, not test keys
          </label>
        </div>

        <Button disabled={action.pending} onClick={() => action.run()}>
          {action.pending ? 'Saving…' : 'Save payment settings'}
        </Button>
      </CardBody>
    </Card>
  )
}
