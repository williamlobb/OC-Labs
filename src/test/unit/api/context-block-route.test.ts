/**
 * Unit tests for PUT /api/v1/projects/[id]/context/[blockId]
 *
 * Covers the empty-body fix (#5): a PUT with no meaningful fields must return
 * 400 instead of silently incrementing the version counter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---- mocks ----------------------------------------------------------------

const { mockGetUser, mockFrom, mockCanEditProjectContent } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockCanEditProjectContent: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/lib/auth/permissions', () => ({
  canEditProjectContent: mockCanEditProjectContent,
}))

// ---- module under test ----------------------------------------------------
import { PUT } from '@/app/api/v1/projects/[id]/context/[blockId]/route'

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

const params = Promise.resolve({ id: 'proj-1', blockId: 'block-1' })

function makeQuery(result: unknown) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
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
    mockCanEditProjectContent.mockResolvedValue(true)
  })

  it('returns 400 when no meaningful fields are provided', async () => {
    mockFrom.mockReturnValue(makeQuery({ data: { id: 'block-1', version: 1 }, error: null }))

    const res = await PUT(makeRequest({}), { params })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: /no fields/i })
  })

  it('returns 400 when only whitespace is provided for title and body', async () => {
    mockFrom.mockReturnValue(makeQuery({ data: { id: 'block-1', version: 1 }, error: null }))

    const res = await PUT(makeRequest({ title: '   ', body: '   ' }), { params })
    expect(res.status).toBe(400)
  })

  it('proceeds when at least one valid field is provided', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return makeQuery({ data: { version: 1 }, error: null })       // fetch existing
      return makeQuery({ data: { id: 'block-1', title: 'New title', version: 2 }, error: null }) // update
    })

    const res = await PUT(makeRequest({ title: 'New title' }), { params })
    expect(res.status).toBe(200)
  })
})
