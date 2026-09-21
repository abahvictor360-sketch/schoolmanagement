import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives'
import { SchoolProfileForm } from '@/components/settings/school-profile-form'

export const metadata: Metadata = { title: 'School profile' }

export default async function SettingsPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()
  const { data } = await supabase
    .from('schools')
    .select('name, address, phone, email, slug')
    .eq('id', ctx.school.id)
    .single()

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>School profile</CardTitle>
        </CardHeader>
        <CardBody>
          <SchoolProfileForm
            school={{
              name: data?.name ?? '',
              address: data?.address ?? '',
              phone: data?.phone ?? '',
              email: data?.email ?? '',
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <p className="text-ink-muted">
            This school&rsquo;s subdomain is fixed once created, because links and bookmarks depend
            on it.
          </p>
          <p className="font-mono text-[13px]">{data?.slug}</p>
        </CardBody>
      </Card>
    </div>
  )
}
