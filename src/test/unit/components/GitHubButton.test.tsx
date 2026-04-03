/**
 * Unit tests for src/components/auth/GitHubButton.tsx
 *
 * supabase.auth.signInWithOAuth is mocked via the module factory.
 * window.location.origin is available in jsdom.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---- mocks ----------------------------------------------------------------

const { mockSignInWithOAuth } = vi.hoisted(() => ({ mockSignInWithOAuth: vi.fn() }))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  },
}))

// ---- module under test ----------------------------------------------------
import { GitHubButton } from '@/components/auth/GitHubButton'

// ---- tests -----------------------------------------------------------------

describe('GitHubButton', () => {
  beforeEach(() => {
    mockSignInWithOAuth.mockReset()
    // Default: OAuth initiates successfully (browser handles the redirect)
    mockSignInWithOAuth.mockResolvedValue({ error: null })
  })

  describe('initial render', () => {
    it('renders a button labelled "Continue with GitHub"', () => {
      render(<GitHubButton />)
      expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument()
    })

    it('button is not disabled on initial render', () => {
      render(<GitHubButton />)
      expect(screen.getByRole('button', { name: /continue with github/i })).not.toBeDisabled()
    })

    it('does not show an error message on initial render', () => {
      render(<GitHubButton />)
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    })
  })

  describe('OAuth initiation', () => {
    it('calls signInWithOAuth with provider "github" on click', async () => {
      const user = userEvent.setup()
      render(<GitHubButton />)

      await user.click(screen.getByRole('button', { name: /continue with github/i }))

      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'github' })
      )
    })

    it('sets the callback URL to /auth/callback on the current origin', async () => {
      const user = userEvent.setup()
      render(<GitHubButton />)

      await user.click(screen.getByRole('button', { name: /continue with github/i }))

      const callArgs = mockSignInWithOAuth.mock.calls[0][0]
      const redirectTo: string = callArgs.options.redirectTo
      expect(redirectTo).toContain('/auth/callback')
      expect(redirectTo).toContain(window.location.origin)
    })

    it('appends a safe redirectTo as the next param in the callback URL', async () => {
      const user = userEvent.setup()
      render(<GitHubButton redirectTo="/projects/new" />)

      await user.click(screen.getByRole('button', { name: /continue with github/i }))

      const callArgs = mockSignInWithOAuth.mock.calls[0][0]
      const redirectTo: string = callArgs.options.redirectTo
      expect(redirectTo).toContain('next=%2Fprojects%2Fnew')
    })

    it('falls back to /discover in the next param when redirectTo does not start with /', async () => {
      const user = userEvent.setup()
      render(<GitHubButton redirectTo="https://evil.example.com" />)

      await user.click(screen.getByRole('button', { name: /continue with github/i }))

      const callArgs = mockSignInWithOAuth.mock.calls[0][0]
      const redirectTo: string = callArgs.options.redirectTo
      expect(redirectTo).toContain('next=%2Fdiscover')
    })
  })

  describe('loading state', () => {
    it('disables the button while the OAuth call is pending', async () => {
      // Delay the mock resolution so we can inspect the in-flight state
      let resolve!: () => void
      mockSignInWithOAuth.mockReturnValue(
        new Promise<{ error: null }>((res) => {
          resolve = () => res({ error: null })
        })
      )

      const user = userEvent.setup()
      render(<GitHubButton />)

      await user.click(screen.getByRole('button', { name: /continue with github/i }))

      expect(screen.getByRole('button')).toBeDisabled()
      resolve()
    })

    it('shows "Redirecting…" text while loading', async () => {
      let resolve!: () => void
      mockSignInWithOAuth.mockReturnValue(
        new Promise<{ error: null }>((res) => {
          resolve = () => res({ error: null })
        })
      )

      const user = userEvent.setup()
      render(<GitHubButton />)

      await user.click(screen.getByRole('button', { name: /continue with github/i }))

      expect(screen.getByRole('button')).toHaveTextContent('Redirecting…')
      resolve()
    })
  })

  describe('OAuth error handling', () => {
    it('displays an error message when signInWithOAuth returns an error', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        error: { message: 'OAuth provider unavailable' },
      })

      const user = userEvent.setup()
      render(<GitHubButton />)

      await user.click(screen.getByRole('button', { name: /continue with github/i }))

      expect(await screen.findByText('OAuth provider unavailable')).toBeInTheDocument()
    })

    it('re-enables the button after an error so the user can retry', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        error: { message: 'Something went wrong' },
      })

      const user = userEvent.setup()
      render(<GitHubButton />)

      await user.click(screen.getByRole('button', { name: /continue with github/i }))

      await screen.findByText('Something went wrong')
      expect(screen.getByRole('button')).not.toBeDisabled()
    })

    it('clears a previous error message on a subsequent click', async () => {
      mockSignInWithOAuth
        .mockResolvedValueOnce({ error: { message: 'First error' } })
        .mockResolvedValue({ error: null })

      const user = userEvent.setup()
      render(<GitHubButton />)

      await user.click(screen.getByRole('button', { name: /continue with github/i }))
      await screen.findByText('First error')

      await user.click(screen.getByRole('button', { name: /continue with github/i }))
      expect(screen.queryByText('First error')).not.toBeInTheDocument()
    })
  })
})
