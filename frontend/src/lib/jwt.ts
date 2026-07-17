import type { AccessTokenClaims } from './types'

/** Base64url-decode and JSON-parse a JWT payload. UI-only — never trusted for
 *  authorization decisions (the server always re-checks). Returns null if the
 *  token is malformed. */
export function decodeJwt(token: string | null | undefined): AccessTokenClaims | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return JSON.parse(json) as AccessTokenClaims
  } catch {
    return null
  }
}

/** True if the token is absent or its `exp` is in the past (with a small skew). */
export function isExpired(claims: AccessTokenClaims | null, skewSeconds = 10): boolean {
  if (!claims?.exp) return true
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000
}
