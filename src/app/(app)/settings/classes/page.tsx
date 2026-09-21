import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listArms } from '@/lib/queries'
import {
  Badge, Card, CardBody, CardHeader, CardTitle, DataTable, EmptyState, Td, Th,
} from '@/components/ui/primitives'
import { ClassSetupForms } from '@/components/settings/class-setup-forms'

export const metadata: Metadata = { title: 'Classes and subjects' }

export default async function ClassesSettingsPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const [{ data: levels }, arms, { data: subjects }, { data: staff }] = await Promise.all([
    supabase
      .from('class_levels')
      .select('id, label, ordinal')
      .eq('school_id', ctx.school.id)
      .order('ordinal'),
    listArms(ctx.school.id),
    supabase
      .from('subjects')
      .select('id, name, code, is_core')
      .eq('school_id', ctx.school.id)
      .order('name'),
    supabase
      .from('staff')
      .select('id, full_name')
      .eq('school_id', ctx.school.id)
      .eq('employment_status', 'active')
      .order('full_name'),
  ])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Class levels</CardTitle>
            <Badge>{levels?.length ?? 0}</Badge>
          </CardHeader>
          {levels && levels.length > 0 ? (
            <DataTable className="min-w-0">
              <thead>
                <tr>
                  <Th>Level</Th>
                  <Th className="text-right">Promotion order</Th>
                </tr>
              </thead>
              <tbody>
                {levels.map((l) => (
                  <tr key={l.id}>
                    <Td className="font-medium">{l.label}</Td>
                    <Td className="text-right tabular-nums">{l.ordinal}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState title="No class levels" description="Add the levels your school runs." />
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Class arms</CardTitle>
            <Badge>{arms.length}</Badge>
          </CardHeader>
          {arms.length > 0 ? (
            <CardBody className="flex flex-wrap gap-1.5">
              {arms.map((a) => (
                <span key={a.id} className="rounded-full border border-line px-2.5 py-1 text-[13px]">
                  {a.full_label}
                </span>
              ))}
            </CardBody>
          ) : (
            <EmptyState title="No class arms" description="Each level needs at least one arm." />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Subjects</CardTitle>
            <Badge>{subjects?.length ?? 0}</Badge>
          </CardHeader>
          {subjects && subjects.length > 0 ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Subject</Th>
                  <Th>Code</Th>
                  <Th>Core</Th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-medium">{s.name}</Td>
                    <Td className="font-mono text-[13px]">{s.code}</Td>
                    <Td>{s.is_core ? <Badge tone="accent">Core</Badge> : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState title="No subjects" description="Add the subjects your school teaches." />
          )}
        </Card>
      </div>

      <ClassSetupForms
        levels={(levels ?? []).map((l) => ({ id: l.id, label: l.label }))}
        nextOrdinal={(levels?.length ?? 0) + 1}
        staff={staff ?? []}
      />
    </div>
  )
}
