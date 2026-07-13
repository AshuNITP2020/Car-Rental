import { describe, expect, it } from 'vitest'
import { decodeJwt, isExpired } from './jwt'

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const makeToken = (payload: Record<string, unknown>) =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.fake-signature`

describe('decodeJwt', () => {
  it('decodes the payload claims', () => {
    const claims = decodeJwt(
      makeToken({ sub: '42', role: 'CUSTOMER', agencyId: 7, agencyRole: 'ADMIN', exp: 123 }),
    )
    expect(claims).toMatchObject({
      sub: '42',
      role: 'CUSTOMER',
      agencyId: 7,
      agencyRole: 'ADMIN',
      exp: 123,
    })
  })

  it('returns null for malformed input', () => {
    expect(decodeJwt(null)).toBeNull()
    expect(decodeJwt('')).toBeNull()
    expect(decodeJwt('not-a-jwt')).toBeNull()
    expect(decodeJwt('a.%%%%.c')).toBeNull()
  })
})

describe('isExpired', () => {
  it('treats missing claims/exp as expired', () => {
    expect(isExpired(null)).toBe(true)
  })

  it('respects exp against the clock (with skew)', () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    const past = Math.floor(Date.now() / 1000) - 3600
    expect(isExpired(decodeJwt(makeToken({ exp: future })))).toBe(false)
    expect(isExpired(decodeJwt(makeToken({ exp: past })))).toBe(true)
  })
})
