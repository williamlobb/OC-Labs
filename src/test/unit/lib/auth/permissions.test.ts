import { describe, expect, it } from 'vitest'
import { canMemberRoleEditProjectContent, canMemberRoleReviewHandRaises } from '@/lib/auth/permissions'

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
