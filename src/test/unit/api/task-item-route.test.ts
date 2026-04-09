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

import { PATCH, DELETE } from '@/app/api/v1/projects/[id]/tasks/[taskId]/route'

const params = Promise.resolve({ id: 'proj-1', taskId: 'task-1' })

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/v1/projects/proj-1/tasks/task-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(): NextRequest {
  return new NextRequest('http://localhost/api/v1/projects/proj-1/tasks/task-1', {
    method: 'DELETE',
  })
}

function makeChainableQuery(result: unknown) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    in: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>

  for (const key of Object.keys(q)) q[key].mockReturnValue(q)
  q.single.mockResolvedValue(result)
  q.maybeSingle.mockResolvedValue(result)
  return q
}

describe('PATCH /api/v1/projects/[id]/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockCanEditProjectContent.mockResolvedValue(true)
  })

  it('returns 403 when caller cannot edit tasks', async () => {
    mockCanEditProjectContent.mockResolvedValue(false)

    const res = await PATCH(makePatchRequest({ title: 'Updated title' }), { params })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'Forbidden' })
  })

  it('maps RLS permission-denied update failures to 403', async () => {
    const existingTaskQuery = makeChainableQuery({
      data: { id: 'task-1', status: 'todo', depends_on: [] },
      error: null,
    })
    const updateTaskQuery = makeChainableQuery({
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy for table "tasks"',
      },
    })

    let taskCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'tasks') throw new Error(`Unexpected table: ${table}`)
      taskCallCount += 1
      return taskCallCount === 1 ? existingTaskQuery : updateTaskQuery
    })

    const res = await PATCH(makePatchRequest({ title: 'Updated title' }), { params })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'Forbidden' })
  })

  it('keeps non-permission update failures as 500', async () => {
    const existingTaskQuery = makeChainableQuery({
      data: { id: 'task-1', status: 'todo', depends_on: [] },
      error: null,
    })
    const updateTaskQuery = makeChainableQuery({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
    })

    let taskCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'tasks') throw new Error(`Unexpected table: ${table}`)
      taskCallCount += 1
      return taskCallCount === 1 ? existingTaskQuery : updateTaskQuery
    })

    const res = await PATCH(makePatchRequest({ title: 'Updated title' }), { params })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({
      error: expect.stringMatching(/duplicate key/i),
    })
  })
})

describe('DELETE /api/v1/projects/[id]/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockCanEditProjectContent.mockResolvedValue(true)
  })

  it('maps RLS permission-denied delete failures to 403', async () => {
    const deleteQuery = {
      error: {
        code: '42501',
        message: 'permission denied for table tasks',
      },
      delete: vi.fn(),
      eq: vi.fn(),
    }
    deleteQuery.delete.mockReturnValue(deleteQuery)
    deleteQuery.eq.mockReturnValue(deleteQuery)

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'tasks') throw new Error(`Unexpected table: ${table}`)
      return deleteQuery
    })

    const res = await DELETE(makeDeleteRequest(), { params })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'Forbidden' })
  })

  it('keeps non-permission delete failures as 500', async () => {
    const deleteQuery = {
      error: {
        code: '08006',
        message: 'connection failure',
      },
      delete: vi.fn(),
      eq: vi.fn(),
    }
    deleteQuery.delete.mockReturnValue(deleteQuery)
    deleteQuery.eq.mockReturnValue(deleteQuery)

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'tasks') throw new Error(`Unexpected table: ${table}`)
      return deleteQuery
    })

    const res = await DELETE(makeDeleteRequest(), { params })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({
      error: expect.stringMatching(/connection failure/i),
    })
  })
})
