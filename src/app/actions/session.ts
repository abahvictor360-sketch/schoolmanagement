'use server'

import { cookies } from 'next/headers'
import { myMemberships } from '@/lib/auth'
import { ACTIVE_SCHOOL_COOKIE } from '@/lib/tenant'

/** The cookie only records a preference; membership is what grants access. */
export async function switchSchool(schoolId: string) {
  const memberships = await myMemberships()
  if (!memberships.some((m) => m.school.id === schoolId)) {
    return { ok: false as const, error: 'You are not a member of that school.' }
  }

  const store = await cookies()
  store.set(ACTIVE_SCHOOL_COOKIE, schoolId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  })
  return { ok: true as const }
}
