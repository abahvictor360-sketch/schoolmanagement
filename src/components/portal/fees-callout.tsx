import Link from 'next/link'
import { CircleCheck, Wallet } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/primitives'
import { PayNowButton } from '@/components/portal/pay-now-button'

/**
 * What is owed, on the pupil's first screen, with the gateway one tap away.
 * Money is the thing a family opens this portal for, so it does not wait
 * behind a navigation step.
 */
export function FeesCallout({
  outstanding,
  formatted,
  invoiceId,
  canPayOnline,
  providerLabel,
  dueOn,
}: {
  outstanding: number
  formatted: string
  invoiceId: string | null
  canPayOnline: boolean
  providerLabel: string
  dueOn: string | null
}) {
  if (outstanding <= 0) {
    return (
      <Card>
        <CardBody className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-tint-mint text-positive">
            <CircleCheck size={20} aria-hidden />
          </span>
          <p className="text-sm font-semibold">School fees for this term are fully paid.</p>
          <Link
            href="/portal/fees"
            className="ml-auto text-[13px] font-semibold text-accent-on-soft underline underline-offset-2"
          >
            Statement
          </Link>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-tint-peach text-icon-peach">
            <Wallet size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink-muted">School fees outstanding</p>
            <p className="text-3xl font-bold tracking-[-0.02em] tabular-nums">{formatted}</p>
            {dueOn ? <p className="text-[12px] text-ink-muted">Due {dueOn}</p> : null}
          </div>
        </div>

        {canPayOnline && invoiceId ? (
          <>
            <PayNowButton invoiceId={invoiceId} providerLabel={providerLabel} />
            <p className="text-[12px] text-ink-muted">
              Pays the full balance. To pay part of it,{' '}
              <Link href="/portal/fees" className="font-semibold text-accent-on-soft underline underline-offset-2">
                open my fees
              </Link>
              .
            </p>
          </>
        ) : (
          <div className="rounded-2xl bg-tint-lemon px-4 py-3 text-[13px]">
            <p className="font-semibold">Online payment is not switched on</p>
            <p className="mt-1 text-ink-muted">
              Pay at the school bursary and they will record it against your invoice.{' '}
              <Link href="/portal/fees" className="font-semibold underline underline-offset-2">
                See the breakdown
              </Link>
              .
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
