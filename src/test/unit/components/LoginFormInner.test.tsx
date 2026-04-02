/**
 * Unit tests for src/app/(auth)/login/LoginFormInner.tsx
 *
 * loginAction is mocked — we test the component's rendering and state
 * transitions, not the server action's logic.
 *
 * useActionState is part of React 19; the test environment must support it.
 * If you see "useActionState is not a function" errors, ensure React 19 is
 * installed and that jsdom is the vitest environment.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---- mocks ----------------------------------------------------------------

// We mock the action module so React's useActionState never fires a real fetch.
// The mock returns a stable async function so pending state can be observed.
vi.mock('@/app/(auth)/login/actions', () => ({
  loginAction: vi.fn().mockResolvedValue({ error: null }),
}))

// ---- module under test ----------------------------------------------------
import { LoginFormInner } from '@/app/(auth)/login/LoginFormInner'

// ---- tests -----------------------------------------------------------------

describe('LoginFormInner', () => {
  describe('initial render', () => {
    it('renders an email input', () => {
      render(<LoginFormInner />)
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
    })

    it('renders a password input', () => {
      render(<LoginFormInner />)
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('renders a submit button with "Sign in" label', () => {
      render(<LoginFormInner />)
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    })

    it('does not render an error message when state is null', () => {
      render(<LoginFormInner />)
      expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
    })

    it('does not render a hidden redirectTo input when prop is not supplied', () => {
      render(<LoginFormInner />)
      expect(screen.queryByDisplayValue(/./)).not.toBeInTheDocument()
    })
  })

  describe('redirectTo prop', () => {
    it('renders a hidden input with the redirectTo value when the prop is provided', () => {
      render(<LoginFormInner redirectTo="/projects/new" />)
      const hiddenInput = screen.getByDisplayValue('/projects/new')
      expect(hiddenInput).toBeInTheDocument()
      expect(hiddenInput).toHaveAttribute('type', 'hidden')
      expect(hiddenInput).toHaveAttribute('name', 'redirectTo')
    })

    it('does not render a hidden redirectTo input when prop is undefined', () => {
      render(<LoginFormInner redirectTo={undefined} />)
      const hiddenInputs = document.querySelectorAll('input[type="hidden"]')
      expect(hiddenInputs).toHaveLength(0)
    })
  })

  describe('error state', () => {
    // To test error display we need to control useActionState's returned state.
    // We do this by re-importing and overriding the mock to resolve with an error.
    it('displays an error message when the action returns an error', async () => {
      const { loginAction } = await import('@/app/(auth)/login/actions')
      ;(loginAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: 'Invalid login credentials',
      })

      const user = userEvent.setup()
      render(<LoginFormInner />)

      await user.type(screen.getByLabelText('Email'), 'bad@example.com')
      await user.type(screen.getByLabelText('Password'), 'wrong')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))

      // Note: useActionState updates after the action settles.
      // If the error does not appear synchronously, wrap with findByText.
      expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('email input has autocomplete="email"', () => {
      render(<LoginFormInner />)
      expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    })

    it('password input has autocomplete="current-password"', () => {
      render(<LoginFormInner />)
      expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
    })

    it('email input is required', () => {
      render(<LoginFormInner />)
      expect(screen.getByLabelText('Email')).toBeRequired()
    })

    it('password input is required', () => {
      render(<LoginFormInner />)
      expect(screen.getByLabelText('Password')).toBeRequired()
    })
  })
})
