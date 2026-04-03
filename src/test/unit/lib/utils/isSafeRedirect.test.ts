/**
 * Unit tests for the isSafeRedirect / isSafeNext open-redirect guard.
 *
 * Implementation note: isSafeRedirect (login/actions.ts) and isSafeNext
 * (auth/callback/route.ts) are identical private functions. Before these tests
 * can run, extract the shared logic to:
 *   src/lib/utils/isSafeRedirect.ts
 * and import it in both action files.
 *
 * Contract: returns true only for paths that are relative to the current origin
 * (i.e. the URL has no hostname component when parsed against a dummy base).
 */
import { describe, it, expect } from 'vitest'
import { isSafeRedirect } from '@/lib/utils/is-safe-redirect'

describe('isSafeRedirect', () => {
  describe('safe inputs — relative paths', () => {
    it('returns true for a simple path', () => {
      expect(isSafeRedirect('/discover')).toBe(true)
    })

    it('returns true for a nested path', () => {
      expect(isSafeRedirect('/projects/abc-123')).toBe(true)
    })

    it('returns true for a path with a query string', () => {
      expect(isSafeRedirect('/discover?tab=new')).toBe(true)
    })

    it('returns true for a path with a hash', () => {
      expect(isSafeRedirect('/login#form')).toBe(true)
    })
  })

  describe('unsafe inputs — absolute URLs', () => {
    it('returns false for an http URL to an external host', () => {
      expect(isSafeRedirect('http://evil.example.com/phish')).toBe(false)
    })

    it('returns false for an https URL to an external host', () => {
      expect(isSafeRedirect('https://evil.example.com')).toBe(false)
    })

    it('returns false for a URL to the same-looking host', () => {
      // Attackers may use the app hostname as a subdomain
      expect(isSafeRedirect('https://oc-labs.evil.com/login')).toBe(false)
    })
  })

  describe('unsafe inputs — protocol-relative and scheme tricks', () => {
    it('returns false for a protocol-relative URL', () => {
      expect(isSafeRedirect('//evil.example.com')).toBe(false)
    })

    it('returns false for a javascript: scheme', () => {
      expect(isSafeRedirect('javascript:alert(1)')).toBe(false)
    })

    it('returns false for a data: URI', () => {
      expect(isSafeRedirect('data:text/html,<script>alert(1)</script>')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('returns false for an empty string', () => {
      expect(isSafeRedirect('')).toBe(false)
    })

    it('returns false for a string that is only whitespace', () => {
      expect(isSafeRedirect('   ')).toBe(false)
    })

    it('returns false for a bare hostname with no leading slash', () => {
      // "evil.com" — parsed relative to the dummy base, hostname becomes 'evil.com'
      // Behaviour depends on URL parser but should not be trusted as safe
      expect(isSafeRedirect('evil.com/path')).toBe(false)
    })

    it('returns false for null cast to string via formData coercion', () => {
      // FormData.get() can return null; callers must check but the guard should handle it
      expect(isSafeRedirect(null as unknown as string)).toBe(false)
    })

    it('returns false for undefined cast to string', () => {
      expect(isSafeRedirect(undefined as unknown as string)).toBe(false)
    })
  })
})
