import { tokenStore } from './token-store'
import type { ApiError, AuthResponse } from './types'

/** All backend routes are already mounted under /api; the Vite dev server (and
 *  nginx in prod) proxies /api -> the Spring Boot backend. */
const BASE = '/api'

/** Normalized error thrown for any non-2xx response (or network failure). */
export class ApiRequestError extends Error {
  status: number
  body?: ApiError
  requestId?: string
  retryAfterSeconds?: number
  fieldErrors?: ApiError['fieldErrors']

  constructor(message: string, opts: Partial<ApiRequestError> = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = opts.status ?? 0
    this.body = opts.body
    this.requestId = opts.requestId
    this.retryAfterSeconds = opts.retryAfterSeconds
    this.fieldErrors = opts.body?.fieldErrors ?? opts.fieldErrors
  }
}

interface RequestOptions {
  method?: string
  /** JSON body — serialized automatically. Ignored when `form` is set. */
  body?: unknown
  /** Multipart body — passed through untouched (browser sets the boundary). */
  form?: FormData
  /** Extra query params (undefined/null values are dropped). */
  params?: Record<string, string | number | boolean | undefined | null>
  /** Set false for public endpoints so no Authorization header is attached. */
  auth?: boolean
  headers?: Record<string, string>
  signal?: AbortSignal
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = BASE + path
  if (!params) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
  }
  const s = qs.toString()
  return s ? `${url}?${s}` : url
}

// ── Single-flight token refresh ──────────────────────────────────────────────
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStore.getRefreshToken()
  if (!refreshToken) throw new ApiRequestError('Session expired', { status: 401 })

  const res = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    tokenStore.clear()
    throw new ApiRequestError('Session expired', { status: 401 })
  }
  const data = (await res.json()) as AuthResponse
  tokenStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken })
  return data.accessToken
}

/** De-duplicate concurrent refreshes: the first 401 refreshes, the rest await it. */
function getFreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function parseError(res: Response): Promise<ApiRequestError> {
  const requestId = res.headers.get('X-Request-Id') ?? undefined
  const retryAfter = res.headers.get('Retry-After')
  let body: ApiError | undefined
  try {
    body = (await res.json()) as ApiError
  } catch {
    /* non-JSON error body */
  }
  return new ApiRequestError(body?.message || res.statusText || `HTTP ${res.status}`, {
    status: res.status,
    body,
    requestId,
    retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
  })
}

async function doFetch(path: string, opts: RequestOptions, accessToken: string | null): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers }
  if (opts.auth !== false && accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  let payload: BodyInit | undefined
  if (opts.form) {
    payload = opts.form // browser sets multipart Content-Type + boundary
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(opts.body)
  }

  return fetch(buildUrl(path, opts.params), {
    method: opts.method ?? 'GET',
    headers,
    body: payload,
    signal: opts.signal,
  })
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response
  try {
    res = await doFetch(path, opts, tokenStore.getAccessToken())
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiRequestError('Network error — is the backend reachable?', { status: 0 })
  }

  // Transparent refresh-and-retry once on 401 for authenticated requests.
  if (res.status === 401 && opts.auth !== false && tokenStore.getRefreshToken()) {
    try {
      const fresh = await getFreshAccessToken()
      res = await doFetch(path, opts, fresh)
    } catch {
      throw new ApiRequestError('Session expired', { status: 401 })
    }
  }

  if (!res.ok) throw await parseError(res)

  if (res.status === 204) return undefined as T
  const contentType = res.headers.get('Content-Type') ?? ''
  if (contentType.includes('application/json')) return (await res.json()) as T
  return (await res.text()) as unknown as T
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body' | 'form'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  del: <T>(path: string, opts?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
  /** Multipart upload (car images, KYC docs). */
  postForm: <T>(path: string, form: FormData, opts?: Omit<RequestOptions, 'method' | 'body' | 'form'>) =>
    request<T>(path, { ...opts, method: 'POST', form }),
}
