import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePlatformAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
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
}

export default async function PlatformPage() {
  const admin = await requirePlatformAdmin()
  const supabase = await createClient()

  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, slug, status, created_at, memberships(count)')
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
