/**
 * Unit tests for POST /api/v1/projects/[id]/updates
 *
 * Covers the membership authorization fix (#7): any authenticated user with a
 * valid API key must be a project member (owner or contributor) to post an update.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---- mocks ----------------------------------------------------------------

const { mockGetUser, mockVerifyApiKey, mockAdminFrom, mockCanEditProjectContent } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockVerifyApiKey: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockCanEditProjectContent: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('@/lib/auth/api-key', () => ({
  verifyApiKey: mockVerifyApiKey,
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: mockAdminFrom },
}))

vi.mock('@/lib/auth/permissions', () => ({
  canEditProjectContent: mockCanEditProjectContent,
}))

// ---- module under test ----------------------------------------------------
import { POST } from '@/app/api/v1/projects/[id]/updates/route'

// ---- helpers ---------------------------------------------------------------

function makeRequest(body: Record<string, unknown>, authHeader?: string): NextRequest {
  return new NextRequest('http://localhost/api/v1/projects/proj-1/updates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: 'proj-1' })

/** Build a chainable Supabase query stub that resolves to `result`. */
function makeQuery(result: unknown) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>

  // Make every method return `q` so calls can be chained
  for (const key of Object.keys(q)) {
    q[key].mockReturnValue(q)
  }
  q.single.mockResolvedValue(result)
  q.maybeSingle.mockResolvedValue(result)
  return q
}

// ---- tests -----------------------------------------------------------------

describe('POST /api/v1/projects/[id]/updates — membership check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanEditProjectContent.mockResolvedValue(true)
  })

  it('returns 403 when session user is not a project member', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockCanEditProjectContent.mockResolvedValue(false)

    mockAdminFrom.mockImplementation(() => makeQuery({ data: { id: 'proj-1' }, error: null }))

    const res = await POST(makeRequest({ body: 'An update' }), { params })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'Forbidden' })
  })

  it('returns 403 when session user has role "interested"', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockCanEditProjectContent.mockResolvedValue(false)

    mockAdminFrom.mockImplementation(() => makeQuery({ data: { id: 'proj-1' }, error: null }))

    const res = await POST(makeRequest({ body: 'An update' }), { params })
    expect(res.status).toBe(403)
  })

  it('returns 403 when bearer-auth user is not a project member', async () => {
    mockVerifyApiKey.mockResolvedValue('user-api-1')
    mockCanEditProjectContent.mockResolvedValue(false)

    mockAdminFrom.mockImplementation(() => makeQuery({ data: { id: 'proj-1' }, error: null }))

    const res = await POST(makeRequest({ body: 'An update' }, 'Bearer valid-key'), { params })
    expect(res.status).toBe(403)
  })

  it('returns 401 when bearer key is invalid', async () => {
    mockVerifyApiKey.mockResolvedValue(null)

    const res = await POST(makeRequest({ body: 'An update' }, 'Bearer bad-key'), { params })
    expect(res.status).toBe(401)
  })

  it('returns 400 when body field is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockCanEditProjectContent.mockResolvedValue(true)
    mockAdminFrom.mockImplementation(() => makeQuery({ data: { id: 'proj-1' }, error: null }))

    const res = await POST(makeRequest({ milestone: false }), { params })
    expect(res.status).toBe(400)
  })
})
