import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`) as Error & { digest: string }
    err.digest = `NEXT_REDIRECT;replace;${url}`
    throw err
  }),
}))

vi.mock('@/components/auth/GitHubButton', () => ({
  GitHubButton: ({ redirectTo }: { redirectTo?: string }) => (
    <div data-testid="github-button">{redirectTo ?? 'none'}</div>
  ),
}))

vi.mock('@/app/(auth)/login/LoginFormInner', () => ({
  LoginFormInner: ({ redirectTo }: { redirectTo?: string }) => (
    <div data-testid="login-form">{redirectTo ?? 'none'}</div>
  ),
}))

import LoginPage from '@/app/(auth)/login/page'

const INVITE_REDIRECT = '/api/v1/invitations/test-token/accept'

describe('LoginPage invite behavior', () => {
  it('sends invitation redirects to /signup by default', async () => {
    await expect(
      LoginPage({
        searchParams: Promise.resolve({ redirectTo: INVITE_REDIRECT }),
      })
    ).rejects.toSatisfy((err: unknown) => {
      const digest = (err as Error & { digest?: string }).digest ?? ''
      expect(digest).toContain(`/signup?redirectTo=${encodeURIComponent(INVITE_REDIRECT)}`)
      return true
    })
  })

  it('keeps invited users on sign in when mode=signin is explicit', async () => {
    const ui = await LoginPage({
      searchParams: Promise.resolve({ redirectTo: INVITE_REDIRECT, mode: 'signin' }),
    })
    render(ui)

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByTestId('login-form')).toHaveTextContent(INVITE_REDIRECT)
    expect(screen.getByTestId('github-button')).toHaveTextContent(INVITE_REDIRECT)
    expect(screen.getByRole('link', { name: 'Create one with this invite' })).toHaveAttribute(
      'href',
      `/signup?redirectTo=${encodeURIComponent(INVITE_REDIRECT)}`
    )
  })
})
