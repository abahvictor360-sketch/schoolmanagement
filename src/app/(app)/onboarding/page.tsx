import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/wizard'

export const metadata: Metadata = { title: 'Set up your school' }

export default async function OnboardingPage() {
  const ctx = await requireSchool()
  if (ctx.role !== 'school_admin' && !ctx.isPlatformAdmin) redirect('/dashboard')
  if (ctx.onboarded) redirect('/settings')

  const supabase = await createClient()
  const { data: school } = await supabase
    .from('schools')
    .select('name, address, phone, email')
    .eq('id', ctx.school.id)
    .single()

  const { data: settings } = await supabase
    .from('school_settings')
    .select('preset_key')
    .eq('school_id', ctx.school.id)
    .maybeSingle()

  return (
    <div className="mx-auto max-w-3xl">
      <OnboardingWizard
        school={{
          name: school?.name ?? ctx.school.name,
          address: school?.address ?? '',
          phone: school?.phone ?? '',
          email: school?.email ?? '',
        }}
        presetKey={(settings?.preset_key ?? 'NG') as 'NG' | 'GH' | 'KE'}
      />
    </div>
  )
}
