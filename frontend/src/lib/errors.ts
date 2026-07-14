import { ApiRequestError } from './api'
import type { ApiError } from './types'

/**
 * Serializable API error shape stored in Redux by the RTK Query baseQuery.
 * (Redux state must be serializable, so `ApiRequestError` instances are
 * flattened to this before entering the store; `.unwrap()` rejects with it.)
 */
export interface SerializedApiError {
  status: number
  message: string
  requestId?: string
  retryAfterSeconds?: number
  fieldErrors?: ApiError['fieldErrors']
}

export function serializeApiError(e: ApiRequestError): SerializedApiError {
  return {
    status: e.status,
    message: e.message,
    requestId: e.requestId,
    retryAfterSeconds: e.retryAfterSeconds,
    fieldErrors: e.fieldErrors,
  }
}

function isSerializedApiError(e: unknown): e is SerializedApiError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'message' in e &&
    typeof (e as SerializedApiError).message === 'string' &&
    'status' in e
  )
}

/** User-facing message for any thrown/rejected value. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message
  if (isSerializedApiError(e)) return e.message
  if (e instanceof Error) return e.message
  return 'Something went wrong'
}

/** X-Request-Id correlation id, when the error carries one. */
export function errorRequestId(e: unknown): string | undefined {
  if (e instanceof ApiRequestError) return e.requestId
  if (isSerializedApiError(e)) return e.requestId
  return undefined
}

/** Field-level validation errors (400), keyed by field name. */
export function fieldErrors(e: unknown): Record<string, string> {
  const list =
    e instanceof ApiRequestError
      ? e.fieldErrors
      : isSerializedApiError(e)
        ? e.fieldErrors
        : undefined
  return list ? Object.fromEntries(list.map((f) => [f.field, f.message])) : {}
}
