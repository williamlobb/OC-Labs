/**
 * Unit tests for src/lib/utils/cn.ts
 * Tests behavior of the className merger — what clsx + tailwind-merge guarantees.
 */
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils/cn'

describe('cn', () => {
  describe('basic merging', () => {
    it('returns a single class unchanged', () => {
      expect(cn('p-4')).toBe('p-4')
    })

    it('joins multiple classes with a space', () => {
      expect(cn('p-4', 'text-sm')).toBe('p-4 text-sm')
    })

    it('joins classes passed as an array', () => {
      expect(cn(['p-4', 'text-sm'])).toBe('p-4 text-sm')
    })
  })

  describe('falsy value handling', () => {
    it('ignores undefined arguments', () => {
      expect(cn('p-4', undefined)).toBe('p-4')
    })

    it('ignores null arguments', () => {
      expect(cn('p-4', null)).toBe('p-4')
    })

    it('ignores false arguments', () => {
      expect(cn('p-4', false)).toBe('p-4')
    })

    it('returns empty string when all arguments are falsy', () => {
      expect(cn(undefined, null, false)).toBe('')
    })
  })

  describe('conditional classes', () => {
    it('includes a class when condition is true', () => {
      expect(cn('base', true && 'active')).toBe('base active')
    })

    it('excludes a class when condition is false', () => {
      expect(cn('base', false && 'active')).toBe('base')
    })
  })

  describe('tailwind conflict resolution', () => {
    it('resolves conflicting padding utilities — last one wins', () => {
      const result = cn('p-2', 'p-4')
      expect(result).toBe('p-4')
    })

    it('resolves conflicting text-color utilities — last one wins', () => {
      const result = cn('text-red-500', 'text-blue-500')
      expect(result).toBe('text-blue-500')
    })

    it('does not remove non-conflicting tailwind classes', () => {
      const result = cn('p-4', 'text-sm', 'font-bold')
      expect(result).toContain('p-4')
      expect(result).toContain('text-sm')
      expect(result).toContain('font-bold')
    })

    it('resolves dark-mode variant conflicts correctly', () => {
      const result = cn('dark:text-white', 'dark:text-zinc-100')
      expect(result).toBe('dark:text-zinc-100')
    })
  })

  describe('object syntax', () => {
    it('includes keys whose value is truthy', () => {
      expect(cn({ 'p-4': true, 'text-sm': false })).toBe('p-4')
    })

    it('excludes keys whose value is falsy', () => {
      expect(cn({ hidden: false })).toBe('')
    })
  })
})
