/**
 * Unit tests for src/lib/auth/upsertUser
 *
 * supabaseAdmin is mocked at the module boundary so no real DB is hit.
 * Tests verify which fields are written and how errors propagate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@supabase/supabase-js'

// ---- mocks ----------------------------------------------------------------
// Must be declared before the module under test is imported.

const mockUpsert = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: () => ({
      upsert: mockUpsert,
    }),
  },
}))

// ---- module under test ----------------------------------------------------
import { upsertUser } from '@/lib/auth/upsert-user'

// ---- helpers ---------------------------------------------------------------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-123',
    email: 'test@example.com',
    user_metadata: {},
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  } as User
}

// ---- tests -----------------------------------------------------------------

describe('upsertUser', () => {
  beforeEach(() => {
    mockUpsert.mockReset()
    mockUpsert.mockResolvedValue({ error: null })
  })

  describe('name resolution', () => {
    it('uses user_metadata.full_name when available', async () => {
      const user = makeUser({ user_metadata: { full_name: 'Alice Smith' } })
      await upsertUser(user)

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Alice Smith' }),
        expect.any(Object)
      )
    })

    it('falls back to user_metadata.name when full_name is absent', async () => {
      const user = makeUser({ user_metadata: { name: 'alice' } })
      await upsertUser(user)

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'alice' }),
        expect.any(Object)
      )
    })

    it('falls back to user_metadata.user_name when full_name and name are absent', async () => {
      const user = makeUser({ user_metadata: { user_name: 'github_alice' } })
      await upsertUser(user)

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'github_alice' }),
        expect.any(Object)
      )
    })

    it('falls back to the email local-part when no name metadata exists', async () => {
      const user = makeUser({ email: 'alice@example.com', user_metadata: {} })
      await upsertUser(user)

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'alice' }),
        expect.any(Object)
      )
    })

    it('falls back to "Unknown" when email is also absent', async () => {
      const user = makeUser({ email: undefined, user_metadata: {} })
      await upsertUser(user)

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Unknown' }),
        expect.any(Object)
      )
    })
  })

  describe('correct fields written', () => {
    it('writes id, email, and resolved name to the users table', async () => {
      const user = makeUser({
        id: 'uuid-abc',
        email: 'bob@example.com',
        user_metadata: { full_name: 'Bob Jones' },
      })
      await upsertUser(user)

      expect(mockUpsert).toHaveBeenCalledWith(
        { id: 'uuid-abc', email: 'bob@example.com', name: 'Bob Jones' },
        { onConflict: 'id' }
      )
    })

    it('resolves without returning a value on success', async () => {
      const user = makeUser()
      await expect(upsertUser(user)).resolves.toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('throws an Error when supabaseAdmin returns an error object', async () => {
      mockUpsert.mockResolvedValue({ error: { message: 'unique violation' } })
      const user = makeUser()

      await expect(upsertUser(user)).rejects.toThrow('Failed to upsert user: unique violation')
    })

    it('propagates unexpected exceptions from the DB call', async () => {
      mockUpsert.mockRejectedValue(new Error('connection refused'))
      const user = makeUser()

      await expect(upsertUser(user)).rejects.toThrow('connection refused')
    })
  })
})
