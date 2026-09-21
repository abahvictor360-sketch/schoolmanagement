import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { LogoForm } from '@/components/settings/logo-form'
import { BrandColorForm } from '@/components/settings/brand-color-form'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Branding' }

export default async function BrandingPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { data } = await supabase
    .from('schools')
    .select('name, logo_url, brand_color')
    .eq('id', ctx.school.id)
    .single()

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <LogoForm name={data?.name ?? ctx.school.name} logoUrl={data?.logo_url ?? null} />
        <BrandColorForm current={data?.brand_color ?? null} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Where it appears</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-[13px] text-ink-muted">
          <p>The logo sits in the sidebar, for staff and for pupils, and heads a printed report
            card or invoice. One upload covers all of them.</p>
          <p>
            The colour drives every button, active menu item, badge and focus ring across staff
            and pupil screens alike.
          </p>
          <p className="text-ink">
            Neither touches print: a report card still comes out black on white, because a page
            of pale brand tint is no use to a school with a laser printer.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
