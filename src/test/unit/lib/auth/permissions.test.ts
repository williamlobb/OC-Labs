import { describe, expect, it, vi } from 'vitest'
import {
  canMemberRoleEditProjectContent,
  canMemberRoleReviewHandRaises,
  canReviewHandRaises,
} from '@/lib/auth/permissions'
import type { MemberRole } from '@/types'

describe('canMemberRoleEditProjectContent', () => {
  it('returns true for content editor roles', () => {
    expect(canMemberRoleEditProjectContent('owner')).toBe(true)
    expect(canMemberRoleEditProjectContent('contributor')).toBe(true)
    expect(canMemberRoleEditProjectContent('tech_lead')).toBe(true)
  })

  it('returns false for non-editor roles or missing roles', () => {
    expect(canMemberRoleEditProjectContent('observer')).toBe(false)
    expect(canMemberRoleEditProjectContent('interested')).toBe(false)
    expect(canMemberRoleEditProjectContent(null)).toBe(false)
    expect(canMemberRoleEditProjectContent(undefined)).toBe(false)
  })
})

describe('canMemberRoleReviewHandRaises', () => {
  it('returns true for owner and tech lead', () => {
    expect(canMemberRoleReviewHandRaises('owner')).toBe(true)
    expect(canMemberRoleReviewHandRaises('tech_lead')).toBe(true)
  })

  it('returns false for non-reviewer roles or missing roles', () => {
    expect(canMemberRoleReviewHandRaises('contributor')).toBe(false)
    expect(canMemberRoleReviewHandRaises('observer')).toBe(false)
    expect(canMemberRoleReviewHandRaises('interested')).toBe(false)
    expect(canMemberRoleReviewHandRaises(null)).toBe(false)
    expect(canMemberRoleReviewHandRaises(undefined)).toBe(false)
  })
})

function makeSupabaseReviewStub(ownerId: string, membershipRole: MemberRole | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'projects') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { owner_id: ownerId } })),
            })),
          })),
        }
      }

      if (table === 'project_members') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: membershipRole ? { role: membershipRole } : null,
                })),
              })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  } as unknown as Parameters<typeof canReviewHandRaises>[0]
}

describe('canReviewHandRaises', () => {
  it('allows the project owner', async () => {
    const supabase = makeSupabaseReviewStub('owner-1', null)
    await expect(canReviewHandRaises(supabase, 'owner-1', 'project-1')).resolves.toBe(true)
  })

  it('allows a tech lead member', async () => {
    const supabase = makeSupabaseReviewStub('owner-1', 'tech_lead')
    await expect(canReviewHandRaises(supabase, 'member-1', 'project-1')).resolves.toBe(true)
  })

  it('denies non-owner and non-tech-lead members', async () => {
    const supabase = makeSupabaseReviewStub('owner-1', 'contributor')
    await expect(canReviewHandRaises(supabase, 'member-1', 'project-1')).resolves.toBe(false)
  })
})
