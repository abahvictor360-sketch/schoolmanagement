'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelSubscription } from '@/app/actions/billing'
import { Button } from '@/components/ui/primitives'

export function CancelSubscription() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!confirming) {
    return (
      <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
        Cancel subscription
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold">Stop renewing this subscription?</p>
      {error ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await cancelSubscription()
              if (!result.ok) { setError(result.error); return }
              setConfirming(false)
              router.refresh()
            })
          }
        >
          {pending ? 'Cancelling…' : 'Yes, stop renewing'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </div>
  )
}
