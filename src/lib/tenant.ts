/**
 * Tenant resolution.
 *
 * Primary strategy is subdomain: greenfield.example.com -> slug "greenfield".
 * An unrecognised subdomain is a 404; it never falls back to a default tenant.
 *
 * Deployments that cannot serve wildcard DNS (a bare *.vercel.app preview, or
 * local development) fall back to an explicit school switcher: the chosen
 * school is carried in a cookie, but the cookie is never trusted on its own —
 * every server request re-checks the membership, and RLS re-checks it again.
 */

export const ACTIVE_SCHOOL_COOKIE = 'schoolhub.school'

/** Hosts that never resolve to a tenant. */
const RESERVED = new Set(['www', 'app', 'admin', 'platform', 'api', 'auth', 'static', 'assets'])

export function rootDomain(): string | null {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase() || null
}

/** Returns the slug encoded in the host, or null when the host has none. */
export function slugFromHost(host: string | null | undefined): string | null {
  if (!host) return null
  const name = host.split(':')[0]?.toLowerCase() ?? ''
  const root = rootDomain()

  if (root && name.endsWith(`.${root}`)) {
    const sub = name.slice(0, -(root.length + 1))
    if (!sub || sub.includes('.') || RESERVED.has(sub)) return null
    return sub
  }

  // localhost development: greenfield.localhost
  if (name.endsWith('.localhost')) {
    const sub = name.slice(0, -'.localhost'.length)
    return sub && !RESERVED.has(sub) ? sub : null
  }

  return null
}

export function isPlatformHost(host: string | null | undefined): boolean {
  if (!host) return false
  const name = host.split(':')[0]?.toLowerCase() ?? ''
  const root = rootDomain()
  return name === `platform.${root}` || name === 'platform.localhost'
}
