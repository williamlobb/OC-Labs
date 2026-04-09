import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetUser,
  mockFrom,
  mockCanEditProjectContent,
  mockCreateIssue,
  mockCreateEpic,
  mockAdminFrom,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockCanEditProjectContent: vi.fn(),
  mockCreateIssue: vi.fn(),
  mockCreateEpic: vi.fn(),
  mockAdminFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: mockAdminFrom },
}))

vi.mock('@/lib/auth/permissions', () => ({
  canEditProjectContent: mockCanEditProjectContent,
}))

vi.mock('@/lib/jira/client', () => ({
  createIssue: mockCreateIssue,
  createEpic: mockCreateEpic,
}))

import { POST } from '@/app/api/v1/projects/[id]/jira/sync/route'

type TaskRow = {
  id: string
  title: string
  body: string | null
  jira_issue_key: string | null
  assignee_id: string | null
}

type ProjectRow = {
  id: string
  title: string
  jira_epic_key: string | null
}

const params = Promise.resolve({ id: 'proj-1' })

function makeRequest(body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/v1/projects/proj-1/jira/sync', {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function makeChainableQuery(result: unknown) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>

  for (const key of Object.keys(q)) q[key].mockReturnValue(q)
  q.single.mockResolvedValue(result)
  q.order.mockResolvedValue(result)
  return q
}

function setupSupabaseData(project: ProjectRow, tasks: TaskRow[]) {
  const projectQuery = makeChainableQuery({ data: project, error: null })
  const tasksQuery = makeChainableQuery({ data: tasks, error: null })

  const updateQuery = {
    eq: vi.fn(),
  }
  updateQuery.eq.mockReturnValue(updateQuery)

  mockFrom.mockImplementation((table: string) => {
    if (table === 'projects') {
      return {
        select: vi.fn().mockReturnValue(projectQuery),
      }
    }

    if (table === 'tasks') {
      return {
        select: vi.fn().mockReturnValue(tasksQuery),
        update: vi.fn().mockReturnValue(updateQuery),
      }
    }

    throw new Error(`Unexpected table in test: ${table}`)
  })
}

describe('POST /api/v1/projects/[id]/jira/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.JIRA_BASE_URL = 'https://jira.example.com'
    process.env.JIRA_EMAIL = 'jira@example.com'
    process.env.JIRA_API_TOKEN = 'token'
    process.env.JIRA_PROJECT_KEY = 'OC'
    process.env.JIRA_ISSUE_TYPE = 'Task'

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockCanEditProjectContent.mockResolvedValue(true)
    mockCreateEpic.mockResolvedValue('OC-EPIC-1')
    mockCreateIssue.mockResolvedValue({
      key: 'OC-101',
      url: 'https://jira.example.com/browse/OC-101',
    })
  })

  it('returns confirmation-required response when unassigned unsynced tasks exist', async () => {
    setupSupabaseData(
      { id: 'proj-1', title: 'Roadmap', jira_epic_key: 'OC-EPIC-1' },
      [
        {
          id: 'task-1',
          title: 'Draft launch notes',
          body: null,
          jira_issue_key: null,
          assignee_id: null,
        },
      ]
    )

    const res = await POST(makeRequest(), { params })
    const payload = await res.json()

    expect(res.status).toBe(409)
    expect(payload).toMatchObject({
      code: 'UNASSIGNED_TASKS_CONFIRMATION_REQUIRED',
      unassignedTaskCount: 1,
      message: expect.stringMatching(/unassigned/i),
      error: expect.stringMatching(/unassigned/i),
    })
    expect(payload.unassignedTaskPreview).toEqual(['Draft launch notes'])
    expect(mockCreateIssue).not.toHaveBeenCalled()
  })

  it('proceeds when allowUnassigned is explicitly confirmed', async () => {
    setupSupabaseData(
      { id: 'proj-1', title: 'Roadmap', jira_epic_key: 'OC-EPIC-1' },
      [
        {
          id: 'task-1',
          title: 'Draft launch notes',
          body: null,
          jira_issue_key: null,
          assignee_id: null,
        },
      ]
    )

    const res = await POST(makeRequest({ allowUnassigned: true }), { params })
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload).toMatchObject({
      created: 1,
      skipped: 0,
      failed: 0,
      warning: expect.stringMatching(/unassigned/i),
    })
    expect(mockCreateIssue).toHaveBeenCalledTimes(1)
  })

  it('preserves auth guards for unauthenticated and forbidden users', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const unauthenticated = await POST(makeRequest(), { params })
    expect(unauthenticated.status).toBe(401)
    expect(await unauthenticated.json()).toMatchObject({ error: 'Unauthorized' })

    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockCanEditProjectContent.mockResolvedValueOnce(false)

    const forbidden = await POST(makeRequest(), { params })
    expect(forbidden.status).toBe(403)
    expect(await forbidden.json()).toMatchObject({ error: 'Forbidden' })
  })

  it('returns layman-friendly error text for Jira field/screen failures', async () => {
    setupSupabaseData(
      { id: 'proj-1', title: 'Roadmap', jira_epic_key: null },
      []
    )
    mockCreateEpic.mockRejectedValueOnce(
      new Error(
        'Jira create epic failed (400): customfield_10011 cannot be set. It is not on the appropriate screen, or unknown.'
      )
    )

    const res = await POST(makeRequest(), { params })
    const payload = await res.json()

    expect(res.status).toBe(500)
    expect(payload.error).toMatch(/quick Epic field setup update/i)
    expect(payload.technicalDetails).toMatch(/customfield_10011/)
  })
})
