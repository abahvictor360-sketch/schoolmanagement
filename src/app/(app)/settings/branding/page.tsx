import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { LogoForm } from '@/components/settings/logo-form'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Branding' }

export default async function BrandingPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { data } = await supabase
    .from('schools')
    .select('name, logo_url')
    .eq('id', ctx.school.id)
    .single()

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <LogoForm name={data?.name ?? ctx.school.name} logoUrl={data?.logo_url ?? null} />
      <Card>
        <CardHeader>
          <CardTitle>Where it appears</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-[13px] text-ink-muted">
          <p>The sidebar, for staff and for pupils.</p>
          <p>The header of a printed report card.</p>
          <p>The header of a printed invoice or receipt.</p>
          <p className="text-ink">
            One upload covers all of them, because every surface reads the same stored URL.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
