/**
 * Unit tests for PUT /api/v1/projects/[id]/context/[blockId]
 *
 * Covers the empty-body fix (#5): a PUT with no meaningful fields must return
 * 400 instead of silently incrementing the version counter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---- mocks ----------------------------------------------------------------

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

// ---- module under test ----------------------------------------------------
import { DELETE, PUT } from '@/app/api/v1/projects/[id]/context/[blockId]/route'

// ---- helpers ---------------------------------------------------------------

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    'http://localhost/api/v1/projects/proj-1/context/block-1',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

function makeDeleteRequest(): NextRequest {
  return new NextRequest(
    'http://localhost/api/v1/projects/proj-1/context/block-1',
    {
      method: 'DELETE',
    }
  )
}

const params = Promise.resolve({ id: 'proj-1', blockId: 'block-1' })

function makeQuery(result: unknown) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>

  for (const key of Object.keys(q)) q[key].mockReturnValue(q)
  q.single.mockResolvedValue(result)
  q.maybeSingle.mockResolvedValue(result)
  return q
}

// ---- tests -----------------------------------------------------------------

describe('PUT /api/v1/projects/[id]/context/[blockId] — empty body guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns 400 when no meaningful fields are provided', async () => {
    mockFrom.mockReturnValue(makeQuery({
      data: { id: 'block-1', author_id: 'user-1', version: 1 },
      error: null,
    }))

    const res = await PUT(makeRequest({}), { params })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: /no fields/i })
  })

  it('returns 400 when only whitespace is provided for title and body', async () => {
    mockFrom.mockReturnValue(makeQuery({
      data: { id: 'block-1', author_id: 'user-1', version: 1 },
      error: null,
    }))

    const res = await PUT(makeRequest({ title: '   ', body: '   ' }), { params })
    expect(res.status).toBe(400)
  })

  it('proceeds when at least one valid field is provided', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return makeQuery({ data: { author_id: 'user-1', version: 1 }, error: null }) // fetch existing
      return makeQuery({ data: { id: 'block-1', title: 'New title', version: 2 }, error: null }) // update
    })

    const res = await PUT(makeRequest({ title: 'New title' }), { params })
    expect(res.status).toBe(200)
  })

  it('returns 403 when user does not own the block', async () => {
    mockFrom.mockReturnValue(makeQuery({
      data: { id: 'block-1', author_id: 'other-user', version: 1 },
      error: null,
    }))

    const res = await PUT(makeRequest({ title: 'New title' }), { params })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'Forbidden' })
  })
})

describe('DELETE /api/v1/projects/[id]/context/[blockId] — ownership guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns 403 when user does not own the block', async () => {
    mockFrom.mockReturnValue(makeQuery({
      data: { id: 'block-1', author_id: 'other-user', attachment_path: null },
      error: null,
    }))

    const res = await DELETE(makeDeleteRequest(), { params })
    expect(res.status).toBe(403)
  })

  it('returns 204 when the author deletes their own block', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) {
        return makeQuery({
          data: { id: 'block-1', author_id: 'user-1', attachment_path: null },
          error: null,
        })
      }
      return makeQuery({ data: null, error: null })
    })

    const res = await DELETE(makeDeleteRequest(), { params })
    expect(res.status).toBe(204)
  })
})
