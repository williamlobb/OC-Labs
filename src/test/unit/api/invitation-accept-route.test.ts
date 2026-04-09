import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))
const { mockAdminFrom } = vi.hoisted(() => ({ mockAdminFrom: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser,
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: mockAdminFrom },
}))

import { GET } from '@/app/api/v1/invitations/[token]/accept/route'

const INVITE_TOKEN = 'test-token'
const INVITE_PATH = `/api/v1/invitations/${INVITE_TOKEN}/accept`

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost${INVITE_PATH}`)
}

function redirectUrl(response: Response): URL {
  return new URL(response.headers.get('location') ?? '')
}

function mockInvitationQuery(invitation: Record<string, unknown> | null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>

  q.select.mockReturnValue(q)
  q.eq.mockReturnValue(q)
  q.update.mockReturnValue(q)
  q.maybeSingle.mockResolvedValue({ data: invitation, error: null })
  q.upsert.mockResolvedValue({ error: null })

  mockAdminFrom.mockImplementation((table: string) => {
    if (table === 'role_invitations') return q
    return {
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }
  })
}

describe('GET /api/v1/invitations/[token]/accept', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockAdminFrom.mockReset()
  })

  it('redirects unauthenticated users to /signup with invite redirectTo', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await GET(makeRequest(), { params: Promise.resolve({ token: INVITE_TOKEN }) })
    const url = redirectUrl(response)

    expect(response.status).toBe(307)
    expect(url.pathname).toBe('/signup')
    expect(url.searchParams.get('redirectTo')).toBe(INVITE_PATH)
  })

  it('redirects to success destination (not back to accept) when invite already accepted for same email', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1', email: 'invitee@theoc.ai' } } })
    mockInvitationQuery({
      id: 'inv-1',
      email: 'invitee@theoc.ai',
      accepted_at: '2026-04-01T00:00:00.000Z',
      platform_role: null,
      project_id: null,
      project_role: null,
    })

    const response = await GET(makeRequest(), { params: Promise.resolve({ token: INVITE_TOKEN }) })
    const url = redirectUrl(response)

    expect(url.pathname).toBe('/discover')
    expect(url.searchParams.get('success')).toBe('role_applied')
  })

  it('redirects explicitly signed-in users with email mismatch to invitation_email_mismatch', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1', email: 'other@theoc.ai' } } })
    mockInvitationQuery({
      id: 'inv-1',
      email: 'invitee@theoc.ai',
      accepted_at: null,
      platform_role: null,
      project_id: null,
      project_role: null,
    })

    const response = await GET(makeRequest(), { params: Promise.resolve({ token: INVITE_TOKEN }) })
    const url = redirectUrl(response)

    expect(url.pathname).toBe('/discover')
    expect(url.searchParams.get('error')).toBe('invitation_email_mismatch')
  })

  it('redirects invalid tokens to discover with invalid_invitation error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1', email: 'invitee@theoc.ai' } } })
    mockInvitationQuery(null)

    const response = await GET(makeRequest(), { params: Promise.resolve({ token: INVITE_TOKEN }) })
    const url = redirectUrl(response)

    expect(url.pathname).toBe('/discover')
    expect(url.searchParams.get('error')).toBe('invalid_invitation')
  })
})
