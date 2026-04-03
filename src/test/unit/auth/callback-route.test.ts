/**
 * Unit tests for src/app/auth/callback/route.ts — GET handler
 *
 * NextRequest / NextResponse are available via 'next/server' which Vitest
 * resolves through the alias config. We construct a minimal NextRequest
 * by passing a URL string to the constructor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---- mocks ----------------------------------------------------------------

const mockExchangeCode = vi.fn()
const mockGetUser = vi.fn()
const mockUpsertUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: mockExchangeCode,
      getUser: mockGetUser,
    },
  }),
}))

vi.mock('@/lib/auth/upsert-user', () => ({
  upsertUser: mockUpsertUser,
}))

// ---- module under test ----------------------------------------------------
import { GET } from '@/app/auth/callback/route'

// ---- helpers ---------------------------------------------------------------

function makeRequest(searchParams: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/auth/callback')
  for (const [key, val] of Object.entries(searchParams)) {
    url.searchParams.set(key, val)
  }
  return new NextRequest(url.toString())
}

function getRedirectPath(response: Response): string {
  const location = response.headers.get('location') ?? ''
  return new URL(location).pathname
}

// ---- tests -----------------------------------------------------------------

describe('GET /auth/callback', () => {
  beforeEach(() => {
    mockExchangeCode.mockReset()
    mockGetUser.mockReset()
    mockUpsertUser.mockReset()
  })

  describe('missing code parameter', () => {
    it('redirects to /login when the code query param is absent', async () => {
      const request = makeRequest({})
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(getRedirectPath(response)).toBe('/login')
    })

    it('does not call exchangeCodeForSession when code is absent', async () => {
      const request = makeRequest({})
      await GET(request)

      expect(mockExchangeCode).not.toHaveBeenCalled()
    })
  })

  describe('code exchange failure', () => {
    it('redirects to /login when exchangeCodeForSession returns an error', async () => {
      mockExchangeCode.mockResolvedValue({ error: { message: 'invalid code' } })

      const request = makeRequest({ code: 'bad-code' })
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(getRedirectPath(response)).toBe('/login')
    })

    it('does not call upsertUser when code exchange fails', async () => {
      mockExchangeCode.mockResolvedValue({ error: { message: 'expired' } })

      const request = makeRequest({ code: 'stale-code' })
      await GET(request)

      expect(mockUpsertUser).not.toHaveBeenCalled()
    })
  })

  describe('successful code exchange', () => {
    const mockUser = { id: 'uid-abc', email: 'user@example.com' }

    beforeEach(() => {
      mockExchangeCode.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockUpsertUser.mockResolvedValue(undefined)
    })

    it('calls upsertUser with the authenticated user', async () => {
      const request = makeRequest({ code: 'valid-code' })
      await GET(request)

      expect(mockUpsertUser).toHaveBeenCalledWith(mockUser)
    })

    it('redirects to /discover by default when next param is absent', async () => {
      const request = makeRequest({ code: 'valid-code' })
      const response = await GET(request)

      expect(getRedirectPath(response)).toBe('/discover')
    })

    it('redirects to a safe relative next param', async () => {
      const request = makeRequest({ code: 'valid-code', next: '/projects/new' })
      const response = await GET(request)

      expect(getRedirectPath(response)).toBe('/projects/new')
    })

    it('falls back to /discover when next param is an absolute URL', async () => {
      const request = makeRequest({ code: 'valid-code', next: 'https://evil.example.com' })
      const response = await GET(request)

      expect(getRedirectPath(response)).toBe('/discover')
    })

    it('falls back to /discover when next param is a protocol-relative URL', async () => {
      const request = makeRequest({ code: 'valid-code', next: '//evil.example.com' })
      const response = await GET(request)

      expect(getRedirectPath(response)).toBe('/discover')
    })
  })

  describe('upsert failure is non-blocking', () => {
    beforeEach(() => {
      mockExchangeCode.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'uid', email: 'u@example.com' } },
      })
      mockUpsertUser.mockRejectedValue(new Error('DB unavailable'))
    })

    it('still redirects to the destination when upsertUser throws', async () => {
      const request = makeRequest({ code: 'valid-code' })
      const response = await GET(request)

      // auth succeeded — user should not be blocked
      expect(response.status).toBe(307)
      expect(getRedirectPath(response)).toBe('/discover')
    })
  })

  describe('user not in session after exchange', () => {
    it('skips upsertUser when getUser returns null', async () => {
      mockExchangeCode.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const request = makeRequest({ code: 'valid-code' })
      await GET(request)

      expect(mockUpsertUser).not.toHaveBeenCalled()
    })
  })
})
