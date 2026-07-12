import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { api } from '../../lib/api'
import { decodeJwt } from '../../lib/jwt'
import { tokenStore } from '../../lib/token-store'
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from '../../lib/types'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  /** Mirror of the access token held by tokenStore (kept in the store so
   *  selectors/components react to token changes). */
  accessToken: string | null
  /** The resolved current user (/me); null until bootstrapped. */
  user: UserResponse | null
}

const initialState: AuthState = {
  accessToken: tokenStore.getAccessToken(),
  user: null,
}

// ── Thunks (async session transitions; token persistence is a side effect on
//    tokenStore, whose subscription dispatches `tokensChanged` back into the
//    store — see store.ts) ────────────────────────────────────────────────────

export const login = createAsyncThunk('auth/login', async (body: LoginRequest) => {
  const res = await api.post<AuthResponse>('/auth/login', body, { auth: false })
  tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken })
  return res.user
})

export const register = createAsyncThunk('auth/register', async (body: RegisterRequest) => {
  const res = await api.post<AuthResponse>('/auth/register', body, { auth: false })
  tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken })
  return res.user
})

/** Resolve the user from stored tokens on app start (or to refresh /me). */
export const bootstrapSession = createAsyncThunk('auth/bootstrap', async () => {
  try {
    return await api.get<UserResponse>('/me')
  } catch (e) {
    tokenStore.clear() // invalid session -> tokensChanged(null) resets state
    throw e
  }
})

/** Rotate tokens via /auth/refresh so the JWT picks up newly-derived claims
 *  (e.g. agencyId right after creating an agency). */
export const reauthenticate = createAsyncThunk('auth/reauthenticate', async () => {
  const refreshToken = tokenStore.getRefreshToken()
  if (!refreshToken) throw new Error('No session')
  const res = await api.post<AuthResponse>('/auth/refresh', { refreshToken }, { auth: false })
  tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken })
  return res.user
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Fired by the tokenStore subscription (store.ts). Clearing tokens ends
     *  the session, so the user resets with them. */
    tokensChanged(state, action: PayloadAction<string | null>) {
      state.accessToken = action.payload
      if (!action.payload) state.user = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload
      })
      .addCase(register.fulfilled, (state, action) => {
        state.user = action.payload
      })
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.user = action.payload
      })
      .addCase(reauthenticate.fulfilled, (state, action) => {
        state.user = action.payload
      })
  },
})

export const { tokensChanged } = authSlice.actions
export const authReducer = authSlice.reducer

// ── Selectors (status is DERIVED from (accessToken, user), never stored) ─────

interface RootWithAuth {
  auth: AuthState
}

export const selectUser = (s: RootWithAuth) => s.auth.user
export const selectAccessToken = (s: RootWithAuth) => s.auth.accessToken

export const selectAuthStatus = (s: RootWithAuth): AuthStatus =>
  !s.auth.accessToken ? 'unauthenticated' : s.auth.user ? 'authenticated' : 'loading'

/** JWT claims, memoized per token. UI gating only — the server re-checks. */
export const selectClaims = createSelector([selectAccessToken], (token) => decodeJwt(token))

export const selectIsAdmin = createSelector(
  [selectUser, selectClaims],
  (user, claims) => (user?.role ?? claims?.role) === 'PLATFORM_ADMIN',
)
export const selectAgencyId = createSelector([selectClaims], (c) => c?.agencyId ?? null)
export const selectAgencyRole = createSelector([selectClaims], (c) => c?.agencyRole ?? null)
