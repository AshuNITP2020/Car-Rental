import { createApi, type BaseQueryFn } from '@reduxjs/toolkit/query/react'
import { ApiRequestError, request, type RequestOptions } from '../lib/api'
import { serializeApiError, type SerializedApiError } from '../lib/errors'

/** Arguments accepted by every endpoint's `query()` — a thin, typed façade
 *  over the shared HTTP client in `lib/api.ts`. */
export interface AppQueryArgs {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  form?: FormData
  params?: RequestOptions['params']
}

/**
 * Custom baseQuery delegating to the app HTTP client, so every RTK Query
 * endpoint inherits Bearer injection, the single-flight 401 -> /auth/refresh
 * -> retry flow, ApiError normalization and X-Request-Id capture. Errors are
 * flattened to a serializable shape before entering the Redux store.
 */
const appBaseQuery: BaseQueryFn<AppQueryArgs, unknown, SerializedApiError> = async (
  { url, method = 'GET', body, form, params },
  { signal },
) => {
  try {
    const data = await request<unknown>(url, { method, body, form, params, signal })
    return { data }
  } catch (e) {
    if (e instanceof ApiRequestError) return { error: serializeApiError(e) }
    throw e // AbortError etc. — let RTK Query handle cancellation
  }
}

/**
 * Root API slice. Feature modules inject their endpoints
 * (`baseApi.injectEndpoints`) so endpoint definitions stay colocated with
 * their feature — see `src/features/{cars,bookings,agency,admin,account}/api.ts`.
 *
 * Tags drive cache invalidation: a mutation that `invalidatesTags` re-fetches
 * every mounted query that `providesTags` the same tag.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: appBaseQuery,
  tagTypes: [
    'Car',
    'CarImages',
    'CarReviews',
    'Availability',
    'Bookings',
    'BookingReview',
    'Agency',
    'AgencyCars',
    'AgencyCarImages',
    'AgencyCarDocs',
    'Dashboard',
    'KycDocs',
    'AdminUsers',
    'AdminDocs',
  ],
  endpoints: () => ({}),
})
