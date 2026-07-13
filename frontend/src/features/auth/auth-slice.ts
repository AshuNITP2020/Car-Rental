import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { api, ApiRequestError } from '../../lib/api'
import { serializeApiError, type SerializedApiError } from '../../lib/errors'
import { decodeJwt } from '../../lib/jwt'
import { tokenStore } from '../../lib/token-store'
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from '../../lib/types'

/** Thunk config: rejections carry a typed, serializable API error so callers
 *  can branch on status (e.g. 404 on login = unknown email -> suggest sign-up). */
type ApiThunkConfig = { rejectValue: SerializedApiError }

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

export const login = createAsyncThunk<UserResponse, LoginRequest, ApiThunkConfig>(
  'auth/login',
  async (body, { rejectWithValue }) => {
    try {
      const res = await api.post<AuthResponse>('/auth/login', body, { auth: false })
      tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken })
      return res.user
    } catch (e) {
      if (e instanceof ApiRequestError) return rejectWithValue(serializeApiError(e))
      throw e
    }
  },
)

/** Creates the account WITHOUT signing in — the user signs in explicitly
 *  afterwards (tokens from the response are deliberately discarded). */
export const register = createAsyncThunk<UserResponse, RegisterRequest, ApiThunkConfig>(
  'auth/register',
  async (body, { rejectWithValue }) => {
    try {
      const res = await api.post<AuthResponse>('/auth/register', body, { auth: false })
      return res.user
    } catch (e) {
      if (e instanceof ApiRequestError) return rejectWithValue(serializeApiError(e))
      throw e
    }
  },
)

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
      // register.fulfilled intentionally does NOT set the user: account
      // creation no longer signs the user in (see register thunk).
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
