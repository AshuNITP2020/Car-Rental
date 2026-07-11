import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import { decodeJwt } from '../lib/jwt'
import { tokenStore, type Tokens } from '../lib/token-store'
import type {
  AccessTokenClaims,
  AgencyRole,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from '../lib/types'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  user: UserResponse | null
  claims: AccessTokenClaims | null
  isAuthenticated: boolean
  isAdmin: boolean
  /** Agency membership (from the JWT claim, not /api/me). */
  agencyId: number | null
  agencyRole: AgencyRole | null
  hasAgency: boolean
  isAgencyAdmin: boolean
  login: (body: LoginRequest) => Promise<UserResponse>
  register: (body: RegisterRequest) => Promise<UserResponse>
  logout: () => void
  /** Re-fetch /api/me (e.g. after KYC upload changes kycStatus). */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokensState] = useState<Tokens | null>(tokenStore.get())
  const [user, setUser] = useState<UserResponse | null>(null)
  const [status, setStatus] = useState<AuthStatus>(tokenStore.get() ? 'loading' : 'unauthenticated')

  // React to token changes anywhere (login, logout, background-refresh failure).
  useEffect(() => tokenStore.subscribe(setTokensState), [])

  const claims = useMemo(() => decodeJwt(tokens?.accessToken), [tokens])

  // Bootstrap: whenever we hold tokens but no user, resolve the user from /me.
  useEffect(() => {
    let cancelled = false
    if (!tokens) {
      setUser(null)
      setStatus('unauthenticated')
      return
    }
    if (user) {
      setStatus('authenticated')
      return
    }
    setStatus('loading')
    api
      .get<UserResponse>('/me')
      .then((u) => {
        if (!cancelled) {
          setUser(u)
          setStatus('authenticated')
        }
      })
      .catch(() => {
        if (!cancelled) tokenStore.clear() // -> subscription flips us to unauthenticated
      })
    return () => {
      cancelled = true
    }
  }, [tokens, user])

  const login = useCallback(async (body: LoginRequest) => {
    const res = await api.post<AuthResponse>('/auth/login', body, { auth: false })
    tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken })
    setUser(res.user)
    setStatus('authenticated')
    return res.user
  }, [])

  const register = useCallback(async (body: RegisterRequest) => {
    const res = await api.post<AuthResponse>('/auth/register', body, { auth: false })
    tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken })
    setUser(res.user)
    setStatus('authenticated')
    return res.user
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const refreshUser = useCallback(async () => {
    const u = await api.get<UserResponse>('/me')
    setUser(u)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const agencyId = claims?.agencyId ?? null
    const agencyRole = claims?.agencyRole ?? null
    return {
      status,
      user,
      claims,
      isAuthenticated: status === 'authenticated',
      isAdmin: (user?.role ?? claims?.role) === 'PLATFORM_ADMIN',
      agencyId,
      agencyRole,
      hasAgency: agencyId != null,
      isAgencyAdmin: agencyRole === 'ADMIN',
      login,
      register,
      logout,
      refreshUser,
    }
  }, [status, user, claims, login, register, logout, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
