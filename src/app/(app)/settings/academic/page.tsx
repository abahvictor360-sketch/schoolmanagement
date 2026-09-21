import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listTerms } from '@/lib/queries'
import {
  Badge, Card, CardBody, CardHeader, CardTitle, DataTable, Td, Th,
} from '@/components/ui/primitives'
import { AcademicConfigEditor } from '@/components/settings/academic-config-editor'
import { CurrentTermPicker } from '@/components/settings/current-term-picker'

export const metadata: Metadata = { title: 'Academic rules' }

export default async function AcademicSettingsPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const [{ data: settings }, terms] = await Promise.all([
    supabase
      .from('school_settings')
      .select('preset_key')
      .eq('school_id', ctx.school.id)
      .maybeSingle(),
    listTerms(ctx.school.id),
  ])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Terms</CardTitle>
          <Badge tone="accent">Preset {settings?.preset_key ?? 'NG'}</Badge>
        </CardHeader>
        <DataTable>
          <thead>
            <tr>
              <Th>Session</Th>
              <Th>Term</Th>
              <Th>Ordinal</Th>
              <Th>Current</Th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <Td>{t.session_label}</Td>
                <Td className="font-medium">{t.label}</Td>
                <Td className="tabular-nums">{t.ordinal}</Td>
                <Td>{t.is_current ? <Badge tone="positive">Current</Badge> : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <CardBody className="border-t border-line">
          <CurrentTermPicker terms={terms} />
        </CardBody>
      </Card>

      <AcademicConfigEditor config={ctx.config} />
    </div>
  )
}
