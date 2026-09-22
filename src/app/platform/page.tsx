import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePlatformAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { deriveState, STATE_COPY } from '@/lib/billing'
import {
  Badge, Card, CardHeader, CardTitle, DataTable, EmptyState, PageHeader, Td, Th,
} from '@/components/ui/primitives'
import { CreateSchoolForm } from '@/components/platform/create-school-form'
import { SignOutButton } from '@/components/sign-out-button'

export const metadata: Metadata = { title: 'Platform admin' }

type SchoolRow = {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
  memberships: { count: number }[]
  subscription: {
    current_period_end: string
    trial_ends_on: string | null
    grace_days: number
    canceled_at: string | null
    plan: { name: string } | null
  } | null
}

export default async function PlatformPage() {
  const admin = await requirePlatformAdmin()
  const supabase = await createClient()

  const { data: schools } = await supabase
    .from('schools')
    .select(
      'id, name, slug, status, created_at, memberships(count), ' +
      'subscription:school_subscriptions(current_period_end, trial_ends_on, grace_days, ' +
      'canceled_at, plan:billing_plans(name))',
    )
    .order('created_at', { ascending: false })
    .returns<SchoolRow[]>()

  return (
    <main id="main" className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Platform admin"
        description={`Signed in as ${admin.email}`}
        actions={
          <>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
            >
              Go to a school
            </Link>
            <SignOutButton />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Schools</CardTitle>
            <Badge>{schools?.length ?? 0}</Badge>
          </CardHeader>
          {schools && schools.length > 0 ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>School</Th>
                  <Th>Subdomain</Th>
                  <Th className="text-right">Members</Th>
                  <Th>Subscription</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-medium">{s.name}</Td>
                    <Td className="font-mono text-[13px]">{s.slug}</Td>
                    <Td className="text-right tabular-nums">{s.memberships[0]?.count ?? 0}</Td>
                    <Td>
                      {(() => {
                        // Recomputed from the same dates the database derives
                        // from, so this column cannot disagree with the gate.
                        const state = deriveState(s.subscription)
                        const copy = STATE_COPY[state]
                        return (
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={copy.tone}>{copy.label}</Badge>
                            <span className="text-[12px] text-ink-muted">
                              {s.subscription?.plan?.name ?? ''}
                              {s.subscription ? ` · to ${s.subscription.current_period_end}` : ''}
                            </span>
                          </span>
                        )
                      })()}
                    </Td>
                    <Td>
                      <Badge tone={s.status === 'active' ? 'positive' : 'warn'} className="capitalize">
                        {s.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState title="No schools yet" description="Create the first one on the right." />
          )}
        </Card>

        <CreateSchoolForm />
      </div>
    </main>
  )
}
