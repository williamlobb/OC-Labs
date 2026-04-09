import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

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

import { POST } from '@/app/api/v1/projects/[id]/tasks/route'

const params = Promise.resolve({ id: 'proj-1' })

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/v1/projects/proj-1/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeInsertQuery(result: unknown) {
  const q = {
    select: vi.fn(),
    single: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>

  for (const key of Object.keys(q)) q[key].mockReturnValue(q)
  q.single.mockResolvedValue(result)
  return q
}

describe('POST /api/v1/projects/[id]/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockCanEditProjectContent.mockResolvedValue(true)
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makePostRequest({ title: 'New task' }), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when user cannot edit project content', async () => {
    mockCanEditProjectContent.mockResolvedValue(false)

    const res = await POST(makePostRequest({ title: 'New task' }), { params })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'Forbidden' })
  })

  it('maps RLS permission-denied insert errors to 403', async () => {
    const insertQuery = makeInsertQuery({
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy for table "tasks"',
      },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'tasks') throw new Error(`Unexpected table: ${table}`)
      return {
        insert: vi.fn().mockReturnValue(insertQuery),
      }
    })

    const res = await POST(makePostRequest({ title: 'New task' }), { params })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'Forbidden' })
  })

  it('keeps non-permission insert errors as 500', async () => {
    const insertQuery = makeInsertQuery({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'tasks') throw new Error(`Unexpected table: ${table}`)
      return {
        insert: vi.fn().mockReturnValue(insertQuery),
      }
    })

    const res = await POST(makePostRequest({ title: 'New task' }), { params })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({
      error: expect.stringMatching(/duplicate key/i),
    })
  })
})
