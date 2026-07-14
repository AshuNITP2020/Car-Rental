import { useCallback, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { tokenStore } from '../../lib/token-store'
import type { LoginRequest, RegisterRequest } from '../../lib/types'
import {
  bootstrapSession,
  login as loginThunk,
  reauthenticate as reauthenticateThunk,
  register as registerThunk,
  selectAgencyId,
  selectAgencyRole,
  selectAuthStatus,
  selectClaims,
  selectIsAdmin,
  selectUser,
} from './auth-slice'

/**
 * Session facade over the Redux auth slice: selectors for state, thunks for
 * transitions. Components use this instead of reaching into the store shape.
 */
export function useAuth() {
  const dispatch = useAppDispatch()
  const status = useAppSelector(selectAuthStatus)
  const user = useAppSelector(selectUser)
  const claims = useAppSelector(selectClaims)
  const isAdmin = useAppSelector(selectIsAdmin)
  const agencyId = useAppSelector(selectAgencyId)
  const agencyRole = useAppSelector(selectAgencyRole)

  const login = useCallback(
    (body: LoginRequest) => dispatch(loginThunk(body)).unwrap(),
    [dispatch],
  )
  const register = useCallback(
    (body: RegisterRequest) => dispatch(registerThunk(body)).unwrap(),
    [dispatch],
  )
  const logout = useCallback(() => {
    tokenStore.clear() // store subscription resets auth state + API cache
  }, [])
  const refreshUser = useCallback(
    async () => void (await dispatch(bootstrapSession()).unwrap()),
    [dispatch],
  )
  const reauthenticate = useCallback(
    async () => void (await dispatch(reauthenticateThunk()).unwrap()),
    [dispatch],
  )

  return useMemo(
    () => ({
      status,
      user,
      claims,
      isAuthenticated: status === 'authenticated',
      isAdmin,
      agencyId,
      agencyRole,
      hasAgency: agencyId != null,
      isAgencyAdmin: agencyRole === 'ADMIN',
      login,
      register,
      logout,
      refreshUser,
      reauthenticate,
    }),
    [status, user, claims, isAdmin, agencyId, agencyRole, login, register, logout, refreshUser, reauthenticate],
  )
}
