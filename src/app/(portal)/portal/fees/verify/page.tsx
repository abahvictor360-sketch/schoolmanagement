import type { Metadata } from 'next'
import Link from 'next/link'
import { requireStudent } from '@/lib/student'
import { verifyPayment } from '@/app/actions/fees'
import { Card, CardBody, PageHeader } from '@/components/ui/primitives'
import { CircleAlert, CircleCheck } from 'lucide-react'

export const metadata: Metadata = { title: 'Payment' }

/**
 * Where the gateway sends the payer back. The reference in the query string is
 * only a pointer: verifyPayment asks the gateway itself what happened, so a
 * hand-edited URL cannot mark an invoice paid.
 */
export default async function VerifyPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string; tx_ref?: string; cancelled?: string }>
}) {
  await requireStudent()
  const params = await searchParams

  // Each gateway names the parameter differently.
  const reference = params.reference ?? params.trxref ?? params.tx_ref ?? ''

  if (!reference) {
    return <Outcome ok={false} title="No payment reference" body="This link is missing its payment reference, so there is nothing to check." />
  }

  const result = await verifyPayment(reference)

  if (!result.ok) {
    return <Outcome ok={false} title="We could not confirm that payment" body={result.error} />
  }

  const { paid, message } = result.data!

  return paid ? (
    <Outcome ok title="Payment received" body={`${message} Your invoice has been updated.`} />
  ) : (
    <Outcome ok={false} title="Payment not completed" body={message} />
  )
}

function Outcome({ ok, title, body }: { ok: boolean; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title="Payment" />
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
            href="/portal/fees"
            className="inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white"
          >
            Back to my fees
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}
