'use client'

import { useState } from 'react'
import { startPayment } from '@/app/actions/fees'
import { useAction } from '@/lib/use-action'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input,
} from '@/components/ui/primitives'

/**
 * The pay button. Deliberately thin: it names an invoice and, optionally, a
 * part amount. The server decides what may actually be charged, so nothing
 * here is trusted — a tampered amount is clamped to the outstanding balance
 * by the database before the gateway is ever called.
 */
export function PayFeesPanel({
  invoiceId,
  invoiceNumber,
  balance,
  pending,
  currency,
  locale,
  canPayOnline,
  providerLabel,
  isLive,
}: {
  invoiceId: string
  invoiceNumber: string
  balance: number
  pending: number
  currency: string
  locale: string
  canPayOnline: boolean
  providerLabel: string
  isLive: boolean
}) {
  const [part, setPart] = useState('')
  const format = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)

  const action = useAction(
    async () => startPayment({ invoice_id: invoiceId, amount: part, payer_kind: 'student' }),
    {
      onSuccess: (data) => {
        const url = (data as { checkoutUrl: string } | undefined)?.checkoutUrl
        // Leaving the app entirely is the point: card details never touch us.
        if (url) window.location.href = url
      },
    },
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay invoice {invoiceNumber}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {pending > 0 ? <Badge tone="warn">{format(pending)} awaiting confirmation</Badge> : null}
          {canPayOnline && !isLive ? <Badge tone="neutral">Test mode</Badge> : null}
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}

        <div className="rounded-2xl bg-tint-violet px-4 py-3">
          <p className="text-[13px] font-medium text-ink-muted">Outstanding</p>
          <p className="text-3xl font-bold tracking-[-0.02em] tabular-nums">{format(balance)}</p>
        </div>

        {canPayOnline ? (
          <>
            <Field
              label="Amount to pay"
              error={action.fieldErrors.amount?.[0]}
              hint={`Leave blank to pay the whole ${format(balance)}. Part payments are allowed.`}
            >
              <Input
                type="number"
                inputMode="decimal"
                min={1}
                max={balance}
                step="0.01"
                value={part}
                placeholder={String(balance)}
                onChange={(event) => setPart(event.target.value)}
              />
            </Field>

            <Button className="w-full" disabled={action.pending} onClick={() => action.run()}>
              {action.pending ? 'Opening checkout…' : `Pay with ${providerLabel}`}
            </Button>

            <p className="text-[12px] text-ink-muted">
              You will be taken to {providerLabel} to pay. Your card details never pass through
              this school&rsquo;s system. Come back afterwards and your invoice updates
              automatically.
            </p>
          </>
        ) : (
          <div className="rounded-2xl bg-tint-lemon px-4 py-3 text-[13px]">
            <p className="font-semibold">Online payment is not switched on</p>
            <p className="mt-1 text-ink-muted">
              Pay at the school bursary and they will record it against this invoice. It will show
              in your payment history once they do.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
