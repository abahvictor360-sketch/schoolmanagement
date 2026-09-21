'use client'

import { Button, Card, CardBody } from '@/components/ui/primitives'

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <h2 className="text-base font-semibold">Something went wrong</h2>
        <p className="text-sm text-ink-muted">{error.message || 'An unexpected error occurred.'}</p>
        <Button onClick={reset}>Try again</Button>
      </CardBody>
    </Card>
  )
}
