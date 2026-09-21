import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { Card, CardBody } from '@/components/ui/primitives'
import { SignOutButton } from '@/components/sign-out-button'

export const metadata: Metadata = { title: 'No school yet' }

export default async function NoSchoolPage() {
  const user = await requireUser()

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4">
      <Card>
        <CardBody className="space-y-3">
          <h1 className="text-lg font-semibold">No school is linked to this account</h1>
          <p className="text-sm text-ink-muted">
            You are signed in as <span className="font-medium text-ink">{user.email}</span>, but no school
            has invited that address yet. Ask your administrator to send an invitation to this exact
            address, then sign out and back in.
          </p>
          <SignOutButton />
        </CardBody>
      </Card>
    </main>
  )
}
