import { afterEach, describe, expect, it } from 'vitest'
import { isPlatformHost, slugFromHost } from '@/lib/tenant'

const withRootDomain = (domain: string | undefined) => {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = domain
}

afterEach(() => withRootDomain(undefined))

describe('tenant resolution', () => {
  it('reads the slug from a subdomain of the configured root', () => {
    withRootDomain('schoolhub.app')
    expect(slugFromHost('greenfield.schoolhub.app')).toBe('greenfield')
    expect(slugFromHost('greenfield.schoolhub.app:443')).toBe('greenfield')
  })

  it('returns no slug for the apex, so it can never fall back to a tenant', () => {
    withRootDomain('schoolhub.app')
    expect(slugFromHost('schoolhub.app')).toBeNull()
    expect(slugFromHost('www.schoolhub.app')).toBeNull()
  })

  it('refuses reserved subdomains', () => {
    withRootDomain('schoolhub.app')
    for (const reserved of ['api', 'admin', 'platform', 'auth', 'www']) {
      expect(slugFromHost(`${reserved}.schoolhub.app`)).toBeNull()
    }
  })

  it('ignores hosts that are not under the root domain', () => {
    withRootDomain('schoolhub.app')
    expect(slugFromHost('greenfield.evil.com')).toBeNull()
    expect(slugFromHost('schoolhub-app.com')).toBeNull()
    expect(slugFromHost(null)).toBeNull()
  })

  it('supports subdomains in local development', () => {
    expect(slugFromHost('greenfield.localhost:3000')).toBe('greenfield')
  })

  it('recognises the platform host', () => {
    withRootDomain('schoolhub.app')
    expect(isPlatformHost('platform.schoolhub.app')).toBe(true)
    expect(isPlatformHost('greenfield.schoolhub.app')).toBe(false)
  })
})
