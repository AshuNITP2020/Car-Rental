import { describe, expect, it } from 'vitest'
import type { UserResponse } from '../../lib/types'
import {
  authReducer,
  login,
  selectAgencyId,
  selectAgencyRole,
  selectAuthStatus,
  selectIsAdmin,
  tokensChanged,
} from './auth-slice'

const user: UserResponse = {
  id: 1,
  name: 'Test',
  email: 't@t.io',
  phone: null,
  kycStatus: 'PENDING',
  role: 'CUSTOMER',
}

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const tokenWith = (claims: Record<string, unknown>) =>
  `${b64url({ alg: 'HS256' })}.${b64url(claims)}.sig`

const state = (accessToken: string | null, u: UserResponse | null) => ({
  auth: { accessToken, user: u },
})

describe('auth status derivation', () => {
  it('is unauthenticated without tokens', () => {
    expect(selectAuthStatus(state(null, null))).toBe('unauthenticated')
  })
  it('is loading with tokens but no resolved user (bootstrap in flight)', () => {
    expect(selectAuthStatus(state('token', null))).toBe('loading')
  })
  it('is authenticated with tokens and a user', () => {
    expect(selectAuthStatus(state('token', user))).toBe('authenticated')
  })
})

describe('auth reducer', () => {
  it('clears the user when tokens are cleared (logout / failed refresh)', () => {
    const before = { accessToken: 'token', user }
    const after = authReducer(before, tokensChanged(null))
    expect(after).toEqual({ accessToken: null, user: null })
  })

  it('keeps the user when tokens rotate', () => {
    const before = { accessToken: 'old', user }
    const after = authReducer(before, tokensChanged('new'))
    expect(after).toEqual({ accessToken: 'new', user })
  })

  it('stores the user on login success', () => {
    const after = authReducer(
      { accessToken: 'token', user: null },
      login.fulfilled(user, 'req', { email: 't@t.io', password: 'x' }),
    )
    expect(after.user).toEqual(user)
  })
})

describe('claim selectors', () => {
  it('derives agency membership from the JWT', () => {
    const s = state(tokenWith({ role: 'CUSTOMER', agencyId: 7, agencyRole: 'ADMIN' }), user)
    expect(selectAgencyId(s)).toBe(7)
    expect(selectAgencyRole(s)).toBe('ADMIN')
    expect(selectIsAdmin(s)).toBe(false)
  })

  it('detects the platform admin role', () => {
    const s = state(tokenWith({ role: 'PLATFORM_ADMIN' }), { ...user, role: 'PLATFORM_ADMIN' })
    expect(selectIsAdmin(s)).toBe(true)
    expect(selectAgencyId(s)).toBeNull()
  })
})
