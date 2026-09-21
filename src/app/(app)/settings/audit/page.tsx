import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, DataTable, EmptyState, Td, Th } from '@/components/ui/primitives'
import { PrintButton } from '@/components/print-button'

export const metadata: Metadata = { title: 'Audit log' }

export default async function AuditPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, entity, entity_id, action, created_at, actor:profiles!audit_log_actor_id_fkey(full_name)')
    .eq('school_id', ctx.school.id)
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<
      { id: number; entity: string; entity_id: string | null; action: string; created_at: string; actor: { full_name: string } | null }[]
    >()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent changes</CardTitle>
        <PrintButton />
      </CardHeader>
      {error ? (
        <EmptyState title="Could not load the audit log" description={error.message} />
      ) : data && data.length > 0 ? (
        <DataTable>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>What</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <Td className="tabular-nums whitespace-nowrap">
                  {new Date(row.created_at).toLocaleString()}
                </Td>
                <Td>{row.actor?.full_name || 'System'}</Td>
                <Td className="font-mono text-[12px]">{row.entity}</Td>
                <Td className="capitalize">{row.action.replace('_', ' ')}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState
          title="Nothing recorded yet"
          description="Every change to a student, staff or enrollment record is written here."
        />
      )}
    </Card>
  )
}
