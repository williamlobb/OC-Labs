import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

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

import { PATCH, DELETE } from '@/app/api/v1/projects/[id]/updates/[updateId]/route'

const params = Promise.resolve({ id: 'proj-1', updateId: 'update-1' })

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/v1/projects/proj-1/updates/update-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(): NextRequest {
  return new NextRequest('http://localhost/api/v1/projects/proj-1/updates/update-1', {
    method: 'DELETE',
  })
}

function makeQuery(result: unknown) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>

  for (const key of Object.keys(q)) q[key].mockReturnValue(q)
  q.single.mockResolvedValue(result)
  return q
}

describe('PATCH /api/v1/projects/[id]/updates/[updateId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns 401 when the user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await PATCH(makePatchRequest({ body: 'Updated text' }), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when the user is not the update author', async () => {
    mockFrom.mockReturnValue(makeQuery({ data: { id: 'update-1', author_id: 'other-user' }, error: null }))

    const res = await PATCH(makePatchRequest({ body: 'Updated text' }), { params })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'Forbidden' })
  })

  it('returns 400 when no editable fields are provided', async () => {
    mockFrom.mockReturnValue(makeQuery({ data: { id: 'update-1', author_id: 'user-1' }, error: null }))

    const res = await PATCH(makePatchRequest({}), { params })
    expect(res.status).toBe(400)
  })

  it('returns 200 when the author updates body and milestone', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) {
        return makeQuery({ data: { id: 'update-1', author_id: 'user-1' }, error: null })
      }
      return makeQuery({
        data: {
          id: 'update-1',
          project_id: 'proj-1',
          author_id: 'user-1',
          body: 'New body',
          milestone: true,
        },
        error: null,
      })
    })

    const res = await PATCH(makePatchRequest({ body: 'New body', milestone: true }), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ body: 'New body', milestone: true })
  })
})

describe('DELETE /api/v1/projects/[id]/updates/[updateId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns 403 when the user is not the update author', async () => {
    mockFrom.mockReturnValue(makeQuery({ data: { id: 'update-1', author_id: 'other-user' }, error: null }))

    const res = await DELETE(makeDeleteRequest(), { params })
    expect(res.status).toBe(403)
  })

  it('returns 204 when the author deletes their update', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) {
        return makeQuery({ data: { id: 'update-1', author_id: 'user-1' }, error: null })
      }
      return makeQuery({ data: null, error: null })
    })

    const res = await DELETE(makeDeleteRequest(), { params })
    expect(res.status).toBe(204)
  })
})
