import { cache } from 'react'
import { headers, cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_SCHOOL_COOKIE, slugFromHost } from '@/lib/tenant'
import { academicConfigSchema, type AcademicConfig, presetConfig } from '@/lib/academic-config'
import type { UserRole } from '@/lib/database.types'

export type SchoolContext = {
  userId: string
  email: string
  fullName: string
  isPlatformAdmin: boolean
  school: { id: string; name: string; slug: string; logo_url: string | null }
  role: UserRole
  config: AcademicConfig
  onboarded: boolean
}

export const currentUser = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
})

export async function requireUser() {
  const user = await currentUser()
  if (!user) redirect('/login')
  return user
}

/** Every school a user may act in, resolved server-side from memberships. */
export const myMemberships = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('memberships')
    .select('role, status, school:schools!inner(id, name, slug, logo_url, status)')
    .eq('status', 'active')
    .returns<
      { role: UserRole; status: string; school: { id: string; name: string; slug: string; logo_url: string | null; status: string } }[]
    >()
  return (data ?? []).filter((m) => m.school.status === 'active')
})

/**
 * Resolves the active school for this request and proves the caller belongs to
 * it. Subdomain wins; otherwise the switcher cookie, validated against the
 * caller's memberships; otherwise their only school.
 */
export const requireSchool = cache(async (): Promise<SchoolContext> => {
  const user = await requireUser()
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()])
  const hostSlug = slugFromHost(headerList.get('host'))
  const memberships = await myMemberships()

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_platform_admin')
    .eq('id', user.id)
    .maybeSingle()
  const isPlatformAdmin = profile?.is_platform_admin ?? false

  let match = hostSlug ? memberships.find((m) => m.school.slug === hostSlug) : undefined

  if (hostSlug && !match) {
    // A real subdomain the caller has no membership in is indistinguishable
    // from one that does not exist. Both are 404.
    notFound()
  }

  if (!match) {
    const cookieSchool = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value
    match = memberships.find((m) => m.school.id === cookieSchool) ?? memberships[0]
  }

  if (!match) redirect(memberships.length === 0 && isPlatformAdmin ? '/platform' : '/no-school')

  const { data: settings } = await supabase
    .from('school_settings')
    .select('preset_key, academic_config, onboarded_at')
    .eq('school_id', match.school.id)
    .maybeSingle()

  const parsed = academicConfigSchema.safeParse(settings?.academic_config)

  return {
    userId: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name || user.email || '',
    isPlatformAdmin,
    school: {
      id: match.school.id,
      name: match.school.name,
      slug: match.school.slug,
      logo_url: match.school.logo_url,
    },
    role: match.role,
    config: parsed.success ? parsed.data : presetConfig(settings?.preset_key ?? 'NG'),
    onboarded: Boolean(settings?.onboarded_at),
  }
})

export async function requireRole(...allowed: UserRole[]): Promise<SchoolContext> {
  const ctx = await requireSchool()
  if (!allowed.includes(ctx.role) && !ctx.isPlatformAdmin) redirect('/dashboard')
  return ctx
}

export async function requirePlatformAdmin() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('is_platform_admin, full_name')
    .eq('id', user.id)
    .maybeSingle()
  if (!data?.is_platform_admin) notFound()
  return { userId: user.id, email: user.email ?? '', fullName: data.full_name }
}
