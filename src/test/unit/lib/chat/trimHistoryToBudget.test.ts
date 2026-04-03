/**
 * Unit tests for src/lib/chat/trim-history.ts
 *
 * Covers the token budget guard fix (#3): history must be trimmed from the
 * oldest end when total character count exceeds the budget.
 */
import { describe, it, expect } from 'vitest'
import { trimHistoryToBudget } from '@/lib/chat/trim-history'

const msg = (role: 'user' | 'assistant', content: string) => ({ role, content })

describe('trimHistoryToBudget', () => {
  it('returns all messages when total is within budget', () => {
    const history = [msg('user', 'hello'), msg('assistant', 'hi')]
    expect(trimHistoryToBudget(history, 1000)).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(trimHistoryToBudget([], 1000)).toEqual([])
  })

  it('drops oldest messages when budget is exceeded', () => {
    const history = [
      msg('user', 'a'.repeat(100)),      // oldest — should be dropped
      msg('assistant', 'b'.repeat(100)),
      msg('user', 'c'.repeat(100)),      // newest — should be kept
    ]
    // Budget fits only the two newest messages (200 chars)
    const result = trimHistoryToBudget(history, 200)
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('b'.repeat(100))
    expect(result[1].content).toBe('c'.repeat(100))
  })

  it('preserves message order (oldest first) in the result', () => {
    const history = [
      msg('user', 'first'),
      msg('assistant', 'second'),
      msg('user', 'third'),
    ]
    const result = trimHistoryToBudget(history, 10000)
    expect(result.map((m) => m.content)).toEqual(['first', 'second', 'third'])
  })

  it('returns empty array when even the newest message exceeds the budget', () => {
    const history = [msg('user', 'a'.repeat(500))]
    expect(trimHistoryToBudget(history, 10)).toHaveLength(0)
  })

  it('keeps exactly the messages that fit within the budget', () => {
    const history = [
      msg('user', 'a'.repeat(50)),
      msg('assistant', 'b'.repeat(50)),
      msg('user', 'c'.repeat(50)),
      msg('assistant', 'd'.repeat(50)),
    ]
    // Budget = 150 → fits the 3 newest (d=50, c=50, b=50 = 150)
    const result = trimHistoryToBudget(history, 150)
    expect(result).toHaveLength(3)
    expect(result[0].content).toBe('b'.repeat(50))
    expect(result[2].content).toBe('d'.repeat(50))
  })
})
