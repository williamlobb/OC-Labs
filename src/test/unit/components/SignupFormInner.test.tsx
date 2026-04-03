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

// ---- tests -----------------------------------------------------------------

describe('SignupFormInner', () => {
  describe('form view (initial render)', () => {
    it('renders a Name input', () => {
      render(<SignupFormInner />)
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    it('renders an Email input', () => {
      render(<SignupFormInner />)
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
    })

    it('renders a Password input', () => {
      render(<SignupFormInner />)
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('renders a submit button with "Create account" label', () => {
      render(<SignupFormInner />)
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
    })

    it('does not render an error message on initial render', () => {
      render(<SignupFormInner />)
      // The error paragraph is only rendered when state.error is truthy
      expect(screen.queryByText(/./)).not.toHaveClass('text-red-600')
    })

    it('password input enforces minLength=6', () => {
      render(<SignupFormInner />)
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
      render(<SignupFormInner />)

      await user.click(screen.getByRole('button', { name: 'Create account' }))

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
      render(<SignupFormInner />)

      await user.type(screen.getByLabelText('Name'), 'Alice')
      await user.type(screen.getByLabelText('Email'), 'alice@example.com')
      await user.type(screen.getByLabelText('Password'), 'secure123')
      await user.click(screen.getByRole('button', { name: 'Create account' }))

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
      render(<SignupFormInner />)

      await user.type(screen.getByLabelText('Name'), 'Alice')
      await user.type(screen.getByLabelText('Email'), 'alice@example.com')
      await user.type(screen.getByLabelText('Password'), 'secure123')
      await user.click(screen.getByRole('button', { name: 'Create account' }))

      const link = await screen.findByRole('link', { name: /back to sign in/i })
      expect(link).toHaveAttribute('href', '/login')
    })

    it('hides the form when confirmation view is displayed', async () => {
      const { signupAction } = await import('@/app/(auth)/signup/actions')
      ;(signupAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: null,
        confirmation: true,
      })

      const user = userEvent.setup()
      render(<SignupFormInner />)

      await user.type(screen.getByLabelText('Name'), 'Alice')
      await user.type(screen.getByLabelText('Email'), 'alice@example.com')
      await user.type(screen.getByLabelText('Password'), 'secure123')
      await user.click(screen.getByRole('button', { name: 'Create account' }))

      await screen.findByText(/check your email/i)
      expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('name input has autocomplete="name"', () => {
      render(<SignupFormInner />)
      expect(screen.getByLabelText('Name')).toHaveAttribute('autocomplete', 'name')
    })

    it('email input has autocomplete="email"', () => {
      render(<SignupFormInner />)
      expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    })

    it('password input has autocomplete="new-password"', () => {
      render(<SignupFormInner />)
      expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    })
  })
})
