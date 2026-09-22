import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { verifySubscriptionPayment } from '@/app/actions/billing'
import { Card, CardBody, PageHeader } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Subscription payment' }

/**
 * Where the gateway sends the payer back. The reference in the query string is
 * only a pointer: the action asks the gateway itself what happened, so a
 * hand-edited URL cannot buy a school a year.
 */
export default async function VerifySubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string; tx_ref?: string }>
}) {
  await requireRole('school_admin')
  const params = await searchParams

  // Each gateway names the parameter differently.
  const reference = params.reference ?? params.trxref ?? params.tx_ref ?? ''

  if (!reference) {
    return (
      <Outcome
        ok={false}
        title="No payment reference"
        body="This link is missing its payment reference, so there is nothing to check."
      />
    )
  }

  const result = await verifySubscriptionPayment(reference)

  if (!result.ok) {
    return <Outcome ok={false} title="We could not confirm that payment" body={result.error} />
  }

  return (
    <Outcome
      ok
      title={result.data!.alreadyPaid ? 'Already confirmed' : 'Subscription renewed'}
      body={
        result.data!.alreadyPaid
          ? 'This payment had already been applied, so nothing was charged twice.'
          : 'Payment received. Saving is enabled again across the school.'
      }
    />
  )
}

function Outcome({ ok, title, body }: { ok: boolean; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title="Subscription payment" />
      <Card>
        <CardBody className="space-y-3 text-center">
          <span
            className={`mx-auto grid size-14 place-items-center rounded-2xl ${
              ok ? 'bg-tint-mint text-positive' : 'bg-tint-lemon text-warn'
            }`}
          >
            {ok ? <CircleCheck size={26} aria-hidden /> : <CircleAlert size={26} aria-hidden />}
          </span>
          <p className="text-base font-bold">{title}</p>
          <p className="text-sm text-ink-muted">{body}</p>
          <Link
            href="/settings/billing"
            className="inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink"
          >
            Back to subscription
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}
