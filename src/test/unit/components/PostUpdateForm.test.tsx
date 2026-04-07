import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PostUpdateForm } from '@/components/projects/PostUpdateForm'

const { mockRefresh } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

describe('PostUpdateForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockRefresh.mockReset()
  })

  it('posts an update and refreshes the page on success', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'update-1' }), { status: 201 })
    )

    const user = userEvent.setup()
    render(<PostUpdateForm projectId="proj-1" />)

    await user.type(
      screen.getByPlaceholderText(/share what changed/i),
      'Ship recap: wrapped auth hardening and updated docs.'
    )
    await user.click(screen.getByRole('button', { name: /post update/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/proj-1/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Ship recap: wrapped auth hardening and updated docs.',
          milestone: false,
        }),
      })
      expect(mockRefresh).toHaveBeenCalled()
    })

    expect(await screen.findByText('Update posted.')).toBeInTheDocument()
  })

  it('renders server error text when the API call fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    )

    const user = userEvent.setup()
    render(<PostUpdateForm projectId="proj-1" initialBody="Draft update" />)
    await user.click(screen.getByRole('button', { name: /post update/i }))

    expect(await screen.findByText('Forbidden')).toBeInTheDocument()
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
