/**
 * Unit tests for src/app/(auth)/login/actions.ts — loginAction
 *
 * next/navigation redirect() throws a special NEXT_REDIRECT error; we detect
 * it by checking the thrown object's .digest property prefix, which is the
 * stable internal contract used by Next.js.
 *
 * createServerSupabaseClient is mocked to avoid real cookie/header access.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- mocks ----------------------------------------------------------------

const mockSignInWithPassword = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}))

// next/navigation redirect() throws — replicate that throw in tests
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`) as Error & { digest: string }
    err.digest = `NEXT_REDIRECT;replace;${url}`
    throw err
  }),
}))

// ---- module under test ----------------------------------------------------
import { loginAction } from '@/app/(auth)/login/actions'

// ---- helpers ---------------------------------------------------------------

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

function expectRedirectTo(error: unknown, path: string) {
  expect(error).toBeInstanceOf(Error)
  expect((error as Error & { digest: string }).digest).toContain(path)
}

// ---- tests -----------------------------------------------------------------

describe('loginAction', () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset()
  })

  describe('credential errors', () => {
    it('returns an error object when Supabase rejects the credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      })

      const result = await loginAction(null, makeFormData({
        email: 'user@example.com',
        password: 'wrong-password',
      }))

      expect(result).toEqual({ error: 'Invalid login credentials' })
    })

    it('returns the exact Supabase error message without modification', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Email not confirmed' },
      })

      const result = await loginAction(null, makeFormData({
        email: 'unconfirmed@example.com',
        password: 'password123',
      }))

      expect(result.error).toBe('Email not confirmed')
    })
  })

  describe('successful login', () => {
    beforeEach(() => {
      mockSignInWithPassword.mockResolvedValue({ error: null })
    })

    it('redirects to /discover when no redirectTo is supplied', async () => {
      await expect(
        loginAction(null, makeFormData({ email: 'u@example.com', password: 'pass123' }))
      ).rejects.toSatisfy((err: unknown) => {
        expectRedirectTo(err, '/discover')
        return true
      })
    })

    it('redirects to a safe relative redirectTo path after login', async () => {
      await expect(
        loginAction(null, makeFormData({
          email: 'u@example.com',
          password: 'pass123',
          redirectTo: '/projects/new',
        }))
      ).rejects.toSatisfy((err: unknown) => {
        expectRedirectTo(err, '/projects/new')
        return true
      })
    })

    it('falls back to /discover when redirectTo is an absolute URL', async () => {
      await expect(
        loginAction(null, makeFormData({
          email: 'u@example.com',
          password: 'pass123',
          redirectTo: 'https://evil.example.com/steal',
        }))
      ).rejects.toSatisfy((err: unknown) => {
        expectRedirectTo(err, '/discover')
        return true
      })
    })

    it('falls back to /discover when redirectTo is a protocol-relative URL', async () => {
      await expect(
        loginAction(null, makeFormData({
          email: 'u@example.com',
          password: 'pass123',
          redirectTo: '//evil.example.com',
        }))
      ).rejects.toSatisfy((err: unknown) => {
        expectRedirectTo(err, '/discover')
        return true
      })
    })

    it('falls back to /discover when redirectTo is empty', async () => {
      await expect(
        loginAction(null, makeFormData({
          email: 'u@example.com',
          password: 'pass123',
          redirectTo: '',
        }))
      ).rejects.toSatisfy((err: unknown) => {
        expectRedirectTo(err, '/discover')
        return true
      })
    })
  })
})
