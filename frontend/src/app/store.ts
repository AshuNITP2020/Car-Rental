import { configureStore } from '@reduxjs/toolkit'
import { tokenStore } from '../lib/token-store'
import { authReducer, tokensChanged } from '../features/auth/auth-slice'
import { baseApi } from './base-api'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Upload mutations carry a File in their arg; it never enters state
        // (query() converts it to FormData), but the check inspects action meta.
        ignoredActionPaths: [/^meta\.arg\.originalArgs\.file$/],
      },
    }).concat(baseApi.middleware),
})

// Keep the auth slice in sync with the token store (login, logout, and the
// API client clearing tokens after a failed refresh all land here). Ending a
// session also drops the whole RTK Query cache so the next user never sees the
// previous user's data.
tokenStore.subscribe((tokens) => {
  store.dispatch(tokensChanged(tokens?.accessToken ?? null))
  if (!tokens) store.dispatch(baseApi.util.resetApiState())
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
