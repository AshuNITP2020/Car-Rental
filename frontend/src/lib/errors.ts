import { ApiRequestError } from './api'

/** User-facing message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message
  if (e instanceof Error) return e.message
  return 'Something went wrong'
}

/** X-Request-Id correlation id, when the error carries one. */
export function errorRequestId(e: unknown): string | undefined {
  return e instanceof ApiRequestError ? e.requestId : undefined
}

/** Field-level validation errors (400), keyed by field name. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (e instanceof ApiRequestError && e.fieldErrors) {
    return Object.fromEntries(e.fieldErrors.map((f) => [f.field, f.message]))
  }
  return {}
}
