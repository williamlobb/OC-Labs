import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockAdminFrom } = vi.hoisted(() => ({ mockAdminFrom: vi.fn() }))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`) as Error & { digest: string }
    err.digest = `NEXT_REDIRECT;replace;${url}`
    throw err
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: mockAdminFrom },
}))

vi.mock('@/components/auth/GitHubButton', () => ({
  GitHubButton: ({ redirectTo }: { redirectTo?: string }) => (
    <div data-testid="github-button">{redirectTo ?? 'none'}</div>
  ),
}))

vi.mock('@/app/(auth)/signup/SignupFormInner', () => ({
  SignupFormInner: ({ redirectTo, invitedEmail }: { redirectTo: string; invitedEmail: string }) => (
    <div data-testid="signup-form">
      {redirectTo}|{invitedEmail}
    </div>
  ),
}))

import SignupPage from '@/app/(auth)/signup/page'

const INVITE_REDIRECT = '/api/v1/invitations/test-token/accept'
const INVITED_EMAIL = 'invitee@theoc.ai'

function mockInvitation(invitation: { email: string; accepted_at: string | null } | null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>

  q.select.mockReturnValue(q)
  q.eq.mockReturnValue(q)
  q.maybeSingle.mockResolvedValue({ data: invitation, error: null })

  mockAdminFrom.mockReturnValue(q)
}

describe('SignupPage invite behavior', () => {
  beforeEach(() => {
    mockAdminFrom.mockReset()
  })

  it('shows invite signup options and explicit sign-in path for invited users', async () => {
    mockInvitation({ email: INVITED_EMAIL, accepted_at: null })

    const ui = await SignupPage({
      searchParams: Promise.resolve({ redirectTo: INVITE_REDIRECT }),
    })
    render(ui)

    expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument()
    expect(screen.getByTestId('signup-form')).toHaveTextContent(`${INVITE_REDIRECT}|${INVITED_EMAIL}`)
    expect(screen.getByTestId('github-button')).toHaveTextContent(INVITE_REDIRECT)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/login?mode=signin&redirectTo=${encodeURIComponent(INVITE_REDIRECT)}`
    )
  })

  it('redirects to explicit sign-in when the invitation is already accepted', async () => {
    mockInvitation({ email: INVITED_EMAIL, accepted_at: '2026-04-01T00:00:00.000Z' })

    await expect(
      SignupPage({
        searchParams: Promise.resolve({ redirectTo: INVITE_REDIRECT }),
      })
    ).rejects.toSatisfy((err: unknown) => {
      const digest = (err as Error & { digest?: string }).digest ?? ''
      expect(digest).toContain(`/login?mode=signin&redirectTo=${encodeURIComponent(INVITE_REDIRECT)}`)
      return true
    })
  })

  it('redirects to /login when invite redirect is missing', async () => {
    await expect(
      SignupPage({
        searchParams: Promise.resolve({}),
      })
    ).rejects.toSatisfy((err: unknown) => {
      const digest = (err as Error & { digest?: string }).digest ?? ''
      expect(digest).toContain('/login')
      return true
    })
  })
})
