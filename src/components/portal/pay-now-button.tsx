'use client'

import { startPayment } from '@/app/actions/fees'
import { useAction } from '@/lib/use-action'
import { Button, ErrorNote } from '@/components/ui/primitives'

/**
 * One tap, straight to the gateway, for the whole outstanding balance. The
 * amount is not sent: the database works out what is still owed and clamps the
 * charge to it, so this button cannot be made to charge the wrong figure.
 *
 * Part payments live on the fees page, which is a link away — this is the path
 * for the parent who just wants to clear the bill from their phone.
 */
export function PayNowButton({
  invoiceId,
  providerLabel,
  className,
}: {
  invoiceId: string
  providerLabel: string
  className?: string
}) {
  const action = useAction(
    async () => startPayment({ invoice_id: invoiceId, amount: '', payer_kind: 'student' }),
    {
      onSuccess: (data) => {
        const url = (data as { checkoutUrl: string } | undefined)?.checkoutUrl
        // Leaving the app entirely is the point: card details never touch us.
        if (url) window.location.href = url
      },
    },
  )

  return (
    <div className={className}>
      {action.error ? (
        <div className="mb-2">
          <ErrorNote>{action.error}</ErrorNote>
        </div>
      ) : null}
      <Button className="w-full" disabled={action.pending} onClick={() => action.run()}>
        {action.pending ? 'Opening checkout…' : `Pay now with ${providerLabel}`}
      </Button>
    </div>
  )
}
