/**
 * Unit tests for middleware.ts (root)
 *
 * updateSession is mocked so we can verify:
 *   1. /signup bypasses it entirely
 *   2. all other routes delegate to it
 *
 * The middleware itself does not redirect — updateSession handles that.
 * We test the routing decision, not the auth logic inside updateSession.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---- mocks ----------------------------------------------------------------

const { mockUpdateSession } = vi.hoisted(() => ({ mockUpdateSession: vi.fn() }))

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: mockUpdateSession,
}))

// ---- module under test ----------------------------------------------------
import { middleware } from '../../../middleware'

// ---- helpers ---------------------------------------------------------------

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`)
}

// ---- tests -----------------------------------------------------------------

describe('middleware', () => {
  beforeEach(() => {
    mockUpdateSession.mockReset()
    mockUpdateSession.mockResolvedValue(NextResponse.next())
  })

  describe('/signup exemption', () => {
    it('does not call updateSession for /signup', async () => {
      const request = makeRequest('/signup')
      await middleware(request)

      expect(mockUpdateSession).not.toHaveBeenCalled()
    })

    it('returns a next response for /signup without calling updateSession', async () => {
      const request = makeRequest('/signup')
      const response = await middleware(request)

      // NextResponse.next() has no redirect status
      expect(response.status).toBe(200)
    })
  })

  describe('all other routes delegate to updateSession', () => {
    const protectedPaths = [
      '/discover',
      '/projects/new',
      '/profile/abc',
      '/login',
      '/auth/callback',
      '/',
    ]

    for (const path of protectedPaths) {
      it(`calls updateSession for ${path}`, async () => {
        const request = makeRequest(path)
        await middleware(request)

        expect(mockUpdateSession).toHaveBeenCalledWith(request)
      })
    }

    it('returns whatever updateSession returns', async () => {
      const customResponse = NextResponse.redirect(new URL('/login', 'http://localhost'))
      mockUpdateSession.mockResolvedValue(customResponse)

      const request = makeRequest('/discover')
      const response = await middleware(request)

      expect(response).toBe(customResponse)
    })
  })

  describe('updateSession redirect behaviour (integration contract)', () => {
    // These tests verify the behaviour of updateSession itself by passing a
    // real (non-mocked) request through the full chain. They require
    // NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env vars
    // to be set; mark them as skipped in unit mode.
    //
    // They are specified here so an implementer knows to promote them to an
    // integration suite once the env is available.

    it.skip('redirects unauthenticated requests to /login with a redirectTo param', () => {
      // Arrange: real request to /discover, no auth cookie
      // Act: call updateSession
      // Assert: response is a redirect to /login?redirectTo=%2Fdiscover
    })

    it.skip('preserves the response for an authenticated user', () => {
      // Arrange: real request to /discover, valid auth cookie in header
      // Act: call updateSession
      // Assert: response.status is 200
    })
  })
})
