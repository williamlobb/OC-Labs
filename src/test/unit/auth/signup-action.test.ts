/**
 * Unit tests for src/app/(auth)/signup/actions.ts — signupAction
 *
 * Critical invariant: no Supabase error message that reveals whether an email
 * is already registered must reach the client (enumeration protection).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- mocks ----------------------------------------------------------------

const { mockSignUp } = vi.hoisted(() => ({ mockSignUp: vi.fn() }))
const { mockUpsertUser } = vi.hoisted(() => ({ mockUpsertUser: vi.fn() }))
const { mockAdminFrom } = vi.hoisted(() => ({ mockAdminFrom: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      signUp: mockSignUp,
    },
  }),
}))

vi.mock('@/lib/auth/upsert-user', () => ({
  upsertUser: mockUpsertUser,
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: mockAdminFrom },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`) as Error & { digest: string }
    err.digest = `NEXT_REDIRECT;replace;${url}`
    throw err
  }),
}))

// ---- module under test ----------------------------------------------------
import { signupAction } from '@/app/(auth)/signup/actions'

// ---- helpers ---------------------------------------------------------------

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

const validFields = {
  name: 'Alice Smith',
  email: 'alice@example.com',
  password: 'secure123',
  redirectTo: '/api/v1/invitations/test-token/accept',
}

function makeValidFormData(overrides: Record<string, string> = {}): FormData {
  return makeFormData({ ...validFields, ...overrides })
}

// ---- tests -----------------------------------------------------------------

describe('signupAction', () => {
  function makeInvitationQuery(invitedEmail = validFields.email) {
    const q = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    } as Record<string, ReturnType<typeof vi.fn>>

    q.select.mockReturnValue(q)
    q.eq.mockReturnValue(q)
    q.maybeSingle.mockResolvedValue({
      data: {
        id: 'inv-123',
        email: invitedEmail,
        accepted_at: null,
      },
      error: null,
    })

    return q
  }

  beforeEach(() => {
    mockSignUp.mockReset()
    mockUpsertUser.mockReset()
    mockAdminFrom.mockReset()
    mockAdminFrom.mockImplementation(() => makeInvitationQuery())
  })

  describe('input validation', () => {
    it('returns an error when name is missing', async () => {
      const result = await signupAction(null, makeFormData({
        name: '',
        email: 'a@example.com',
        password: 'pass123',
        redirectTo: validFields.redirectTo,
      }))
      expect(result.error).toBe('Name is required.')
    })

    it('returns an error when name is only whitespace', async () => {
      const result = await signupAction(null, makeFormData({
        name: '   ',
        email: 'a@example.com',
        password: 'pass123',
        redirectTo: validFields.redirectTo,
      }))
      expect(result.error).toBe('Name is required.')
    })

    it('returns an error when email is missing', async () => {
      const result = await signupAction(null, makeFormData({
        name: 'Alice',
        email: '',
        password: 'pass123',
        redirectTo: validFields.redirectTo,
      }))
      expect(result.error).toBe('Email is required.')
    })

    it('returns an error when email format is invalid', async () => {
      const result = await signupAction(null, makeFormData({
        name: 'Alice',
        email: 'not-an-email',
        password: 'pass123',
        redirectTo: validFields.redirectTo,
      }))
      expect(result.error).toBe('Please enter a valid email address.')
    })

    it('returns an error when password is absent', async () => {
      const result = await signupAction(null, makeFormData({
        name: 'Alice',
        email: 'a@example.com',
        password: '',
        redirectTo: validFields.redirectTo,
      }))
      expect(result.error).toBe('Password must be at least 6 characters.')
    })

    it('returns an error when password is shorter than 6 characters', async () => {
      const result = await signupAction(null, makeFormData({
        name: 'Alice',
        email: 'a@example.com',
        password: '12345',
        redirectTo: validFields.redirectTo,
      }))
      expect(result.error).toBe('Password must be at least 6 characters.')
    })

    it('does not call Supabase when client-side validation fails', async () => {
      await signupAction(
        null,
        makeFormData({
          name: '',
          email: '',
          password: '',
          redirectTo: validFields.redirectTo,
        })
      )
      expect(mockSignUp).not.toHaveBeenCalled()
    })
  })

  describe('email enumeration protection', () => {
    const alreadyRegisteredMessages = [
      'User already registered',
      'Email address is already in use',
      'already exists',
    ]

    for (const message of alreadyRegisteredMessages) {
      it(`maps "${message}" to the generic confirmation message`, async () => {
        mockSignUp.mockResolvedValue({ data: {}, error: { message } })

        const result = await signupAction(null, makeValidFormData())

        expect(result.error).toBe(
          'Check your email — if this address is new, a confirmation link is on its way.'
        )
        // Must not leak any indication that the email is registered
        expect(result.error).not.toContain('registered')
        expect(result.error).not.toContain('already')
        expect(result.error).not.toContain('exists')
      })
    }
  })

  describe('supabase error mapping', () => {
    it('maps an invalid email error from Supabase', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: { message: 'invalid email address' },
      })

      const result = await signupAction(null, makeValidFormData())
      expect(result.error).toBe('Please enter a valid email address.')
    })

    it('maps a weak password error from Supabase', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: { message: 'password is too short' },
      })

      const result = await signupAction(null, makeValidFormData())
      expect(result.error).toBe('Password must be at least 6 characters.')
    })

    it('maps an unrecognised Supabase error to the generic fallback', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: { message: 'some internal database error' },
      })

      const result = await signupAction(null, makeValidFormData())
      expect(result.error).toBe('Something went wrong. Please try again.')
    })
  })

  describe('confirmation email flow', () => {
    it('returns confirmation: true when Supabase returns a user but no session', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'uid', email: 'a@example.com' }, session: null },
        error: null,
      })

      const result = await signupAction(null, makeValidFormData())

      expect(result.error).toBeNull()
      expect(result.confirmation).toBe(true)
    })

    it('returns confirmation: true when Supabase returns neither user nor session', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      })

      const result = await signupAction(null, makeValidFormData())

      expect(result.error).toBeNull()
      expect(result.confirmation).toBe(true)
    })
  })

  describe('immediate session flow', () => {
    const sessionUser = {
      id: 'uid-123',
      email: 'alice@example.com',
      user_metadata: { name: 'Alice Smith' },
    }

    const sessionData = {
      user: sessionUser,
      session: { access_token: 'tok', user: sessionUser },
    }

    beforeEach(() => {
      mockSignUp.mockResolvedValue({ data: sessionData, error: null })
      mockUpsertUser.mockResolvedValue(undefined)
    })

    it('calls upsertUser with the user from the session', async () => {
      await expect(
        signupAction(null, makeValidFormData())
      ).rejects.toThrow() // redirect throws

      expect(mockUpsertUser).toHaveBeenCalledWith(sessionUser)
    })

    it('redirects back to invitation acceptance after a successful upsert', async () => {
      await expect(
        signupAction(null, makeValidFormData())
      ).rejects.toSatisfy((err: unknown) => {
        return (err as Error & { digest: string }).digest?.includes(validFields.redirectTo)
      })
    })

    it('returns a profile-setup error when upsertUser throws', async () => {
      mockUpsertUser.mockRejectedValue(new Error('DB error'))

      const result = await signupAction(null, makeValidFormData())

      expect(result.error).toBe(
        'Account created but profile setup failed. Please contact support.'
      )
    })

    it('does not redirect when upsertUser fails', async () => {
      mockUpsertUser.mockRejectedValue(new Error('DB error'))

      // resolves normally (returns error object) rather than throwing redirect
      const result = await signupAction(null, makeValidFormData())
      expect(result).toBeDefined()
    })
  })
})
