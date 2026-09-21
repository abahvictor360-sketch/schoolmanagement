import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  Badge, Card, CardBody, CardHeader, CardTitle, DataTable, EmptyState, Td, Th,
} from '@/components/ui/primitives'
import { InviteForm } from '@/components/settings/invite-form'

export const metadata: Metadata = { title: 'Access' }

type Member = {
  id: string
  role: string
  status: string
  profile: { full_name: string } | null
}

export default async function AccessSettingsPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from('memberships')
      .select('id, role, status, profile:profiles(full_name)')
      .eq('school_id', ctx.school.id)
      .returns<Member[]>(),
    supabase
      .from('school_invitations')
      .select('id, email, role, accepted_at, created_at')
      .eq('school_id', ctx.school.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <Badge>{members?.length ?? 0}</Badge>
          </CardHeader>
          {members && members.length > 0 ? (
            <DataTable className="min-w-0">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <Td className="font-medium">{m.profile?.full_name || 'Unnamed'}</Td>
                    <Td className="capitalize">{m.role.replace('_', ' ')}</Td>
                    <Td>
                      <Badge tone={m.status === 'active' ? 'positive' : 'warn'} className="capitalize">
                        {m.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState title="No members yet" description="Invite an administrator or teacher." />
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
          </CardHeader>
          {invitations && invitations.length > 0 ? (
            <DataTable className="min-w-0">
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((i) => (
                  <tr key={i.id}>
                    <Td>{i.email}</Td>
                    <Td className="capitalize">{i.role.replace('_', ' ')}</Td>
                    <Td>
                      {i.accepted_at ? (
                        <Badge tone="positive">Accepted</Badge>
                      ) : (
                        <Badge tone="warn">Waiting for sign-up</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState title="No invitations" description="Invited people join by signing up with that email." />
          )}
        </Card>
      </div>

      <div className="no-print">
        <InviteForm />
      </div>
    </div>
  )
}
