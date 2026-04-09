import { describe, expect, it } from 'vitest'
import { canMemberRoleEditProjectContent } from '@/lib/auth/permissions'

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
