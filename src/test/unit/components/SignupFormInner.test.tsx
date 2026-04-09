/**
 * Unit tests for src/app/(auth)/signup/SignupFormInner.tsx
 *
 * Tests the two major render states: the form view and the confirmation view.
 * signupAction is mocked.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---- mocks ----------------------------------------------------------------

vi.mock('@/app/(auth)/signup/actions', () => ({
  signupAction: vi.fn().mockResolvedValue({ error: null }),
}))

// ---- module under test ----------------------------------------------------
import { SignupFormInner } from '@/app/(auth)/signup/SignupFormInner'

const INVITE_REDIRECT = '/api/v1/invitations/test-token/accept'
const INVITED_EMAIL = 'invitee@theoc.ai'

// ---- tests -----------------------------------------------------------------

describe('SignupFormInner', () => {
  describe('form view (initial render)', () => {
    it('renders a Name input', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    it('renders an Email input', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
    })

    it('renders a Password input', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('renders a confirm password input', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    })

    it('renders a submit button with "Create account with email" label', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.getByRole('button', { name: 'Create account with email' })).toBeInTheDocument()
    })

    it('prefills the invited email', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.getByLabelText('Email')).toHaveValue(INVITED_EMAIL)
    })

    it('does not render the action error message on initial render', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.queryByText('Name is required.')).not.toBeInTheDocument()
    })

    it('password input enforces minLength=6', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      const passwordInput = screen.getByLabelText('Password')
      expect(passwordInput).toHaveAttribute('minLength', '6')
    })
  })

  describe('error state', () => {
    it('shows a validation error returned by the action', async () => {
      const { signupAction } = await import('@/app/(auth)/signup/actions')
      ;(signupAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: 'Name is required.',
        confirmation: false,
      })

      const user = userEvent.setup()
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)

      await user.type(screen.getByLabelText("Name"), "Test User")
      await user.clear(screen.getByLabelText("Email"))
      await user.type(screen.getByLabelText("Email"), "test@example.com")
      await user.type(screen.getByLabelText("Password"), "password123")
      await user.type(screen.getByLabelText("Confirm password"), "password123")
      await user.click(screen.getByRole('button', { name: 'Create account with email' }))

      expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    })
  })

  describe('confirmation view', () => {
    it('shows the confirmation message when state.confirmation is true', async () => {
      const { signupAction } = await import('@/app/(auth)/signup/actions')
      ;(signupAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: null,
        confirmation: true,
      })

      const user = userEvent.setup()
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)

      await user.type(screen.getByLabelText('Name'), 'Alice')
      await user.clear(screen.getByLabelText('Email'))
      await user.type(screen.getByLabelText('Email'), 'alice@example.com')
      await user.type(screen.getByLabelText('Password'), 'secure123')
      await user.type(screen.getByLabelText('Confirm password'), 'secure123')
      await user.click(screen.getByRole('button', { name: 'Create account with email' }))

      expect(
        await screen.findByText(/check your email for a confirmation link/i)
      ).toBeInTheDocument()
    })

    it('shows a "Back to sign in" link in the confirmation view', async () => {
      const { signupAction } = await import('@/app/(auth)/signup/actions')
      ;(signupAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: null,
        confirmation: true,
      })

      const user = userEvent.setup()
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)

      await user.type(screen.getByLabelText('Name'), 'Alice')
      await user.clear(screen.getByLabelText('Email'))
      await user.type(screen.getByLabelText('Email'), 'alice@example.com')
      await user.type(screen.getByLabelText('Password'), 'secure123')
      await user.type(screen.getByLabelText('Confirm password'), 'secure123')
      await user.click(screen.getByRole('button', { name: 'Create account with email' }))

      const link = await screen.findByRole('link', { name: /back to sign in/i })
      expect(link).toHaveAttribute(
        'href',
        `/login?mode=signin&redirectTo=${encodeURIComponent(INVITE_REDIRECT)}`
      )
    })

    it('hides the form when confirmation view is displayed', async () => {
      const { signupAction } = await import('@/app/(auth)/signup/actions')
      ;(signupAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: null,
        confirmation: true,
      })

      const user = userEvent.setup()
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)

      await user.type(screen.getByLabelText('Name'), 'Alice')
      await user.clear(screen.getByLabelText('Email'))
      await user.type(screen.getByLabelText('Email'), 'alice@example.com')
      await user.type(screen.getByLabelText('Password'), 'secure123')
      await user.type(screen.getByLabelText('Confirm password'), 'secure123')
      await user.click(screen.getByRole('button', { name: 'Create account with email' }))

      await screen.findByText(/check your email/i)
      expect(screen.queryByRole('button', { name: 'Create account with email' })).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('name input has autocomplete="name"', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.getByLabelText('Name')).toHaveAttribute('autocomplete', 'name')
    })

    it('email input has autocomplete="email"', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    })

    it('password input has autocomplete="new-password"', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    })

    it('confirm password input has autocomplete="new-password"', () => {
      render(<SignupFormInner redirectTo={INVITE_REDIRECT} invitedEmail={INVITED_EMAIL} />)
      expect(screen.getByLabelText('Confirm password')).toHaveAttribute('autocomplete', 'new-password')
    })
  })
})
