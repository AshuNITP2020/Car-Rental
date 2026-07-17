import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiRequestError } from './api'
import { tokenStore } from './token-store'

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

const authHeader = (init?: RequestInit) =>
  (init?.headers as Record<string, string> | undefined)?.['Authorization']

describe('api client', () => {
  beforeEach(() => {
    tokenStore.set({ accessToken: 'old-access', refreshToken: 'refresh-1' })
  })
  afterEach(() => {
    tokenStore.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends the Bearer token and parses JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.get<{ ok: boolean }>('/me')

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.anything())
    expect(authHeader(fetchMock.mock.calls[0][1])).toBe('Bearer old-access')
  })

  it('serializes query params and drops empty values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([]))
    vi.stubGlobal('fetch', fetchMock)

    await api.get('/cars/search', { params: { city: 'Pune', page: 0, q: undefined, sort: '' } })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/cars/search?city=Pune&page=0')
  })

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/auth/refresh') {
        return Promise.resolve(
          json({ accessToken: 'new-access', refreshToken: 'refresh-2', user: null }),
        )
      }
      return Promise.resolve(
        authHeader(init) === 'Bearer new-access'
          ? json({ id: 1 })
          : new Response(null, { status: 401 }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.get<{ id: number }>('/me')

    expect(result).toEqual({ id: 1 })
    expect(tokenStore.getAccessToken()).toBe('new-access')
    expect(tokenStore.getRefreshToken()).toBe('refresh-2')
  })

  it('deduplicates concurrent refreshes (single-flight)', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/auth/refresh') {
        return Promise.resolve(
          json({ accessToken: 'new-access', refreshToken: 'refresh-2', user: null }),
        )
      }
      return Promise.resolve(
        authHeader(init) === 'Bearer new-access'
          ? json({ ok: true })
          : new Response(null, { status: 401 }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh')
    expect(refreshCalls).toHaveLength(1)
  })

  it('clears the session when the refresh itself fails', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(new Response(null, { status: 401, statusText: url })),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/me')).rejects.toMatchObject({ status: 401 })
    expect(tokenStore.get()).toBeNull()
  })

  it('normalizes ApiError bodies with request id, fieldErrors and Retry-After', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(
        {
          status: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          path: '/api/bookings',
          fieldErrors: [{ field: 'from', message: 'must be in the future' }],
        },
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': 'req-123',
            'Retry-After': '30',
          },
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await api.post('/bookings', {}).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiRequestError)
    const apiError = error as ApiRequestError
    expect(apiError.status).toBe(400)
    expect(apiError.message).toBe('Validation failed')
    expect(apiError.requestId).toBe('req-123')
    expect(apiError.retryAfterSeconds).toBe(30)
    expect(apiError.fieldErrors).toEqual([{ field: 'from', message: 'must be in the future' }])
  })

  it('does not attach Authorization on auth:false requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}))
    vi.stubGlobal('fetch', fetchMock)

    await api.post('/auth/login', { email: 'a@b.c', password: 'x' }, { auth: false })

    expect(authHeader(fetchMock.mock.calls[0][1])).toBeUndefined()
  })
})
