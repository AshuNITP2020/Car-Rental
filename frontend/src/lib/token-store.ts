/**
 * Single source of truth for JWT tokens.
 *
 * Tokens live in localStorage so a page refresh keeps the session, and in a
 * tiny pub/sub so the auth context can react when they are set or cleared
 * (e.g. a background refresh failure clears them -> guards redirect to /login).
 */
const STORAGE_KEY = 'cr.tokens'

export interface Tokens {
  accessToken: string
  refreshToken: string
}

type Listener = (tokens: Tokens | null) => void
const listeners = new Set<Listener>()

let current: Tokens | null = load()

function load(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Tokens) : null
  } catch {
    return null
  }
}

function emit() {
  for (const l of listeners) l(current)
}

export const tokenStore = {
  get: (): Tokens | null => current,
  getAccessToken: (): string | null => current?.accessToken ?? null,
  getRefreshToken: (): string | null => current?.refreshToken ?? null,

  set(tokens: Tokens) {
    current = tokens
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
    } catch {
      /* ignore quota / privacy-mode errors */
    }
    emit()
  },

  clear() {
    current = null
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    emit()
  },

  /** Subscribe to token changes. Returns an unsubscribe fn. */
  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}
