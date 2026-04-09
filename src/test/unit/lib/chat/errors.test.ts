import { describe, expect, it } from 'vitest'
import {
  PROJECT_CHAT_TIMEOUT_MESSAGE,
  PROJECT_CHAT_UNAVAILABLE_MESSAGE,
  shouldResetProjectChatSession,
  toFriendlyProjectChatError,
} from '@/lib/chat/errors'

describe('toFriendlyProjectChatError', () => {
  it('maps timeout-like upstream messages to the friendly timeout text', () => {
    const result = toFriendlyProjectChatError('function_invocation_timeout on upstream')
    expect(result).toBe(PROJECT_CHAT_TIMEOUT_MESSAGE)
  })

  it('maps timeout status codes to the friendly timeout text', () => {
    expect(toFriendlyProjectChatError('Request failed', 504)).toBe(PROJECT_CHAT_TIMEOUT_MESSAGE)
    expect(toFriendlyProjectChatError('Request failed', 524)).toBe(PROJECT_CHAT_TIMEOUT_MESSAGE)
  })

  it('maps unavailable status codes to the friendly unavailable text', () => {
    const result = toFriendlyProjectChatError('Agent unavailable', 502)
    expect(result).toBe(PROJECT_CHAT_UNAVAILABLE_MESSAGE)
  })

  it('preserves non-platform errors and trims very long messages', () => {
    expect(toFriendlyProjectChatError('Bad request: missing field', 400)).toBe('Bad request: missing field')

    const long = 'x'.repeat(300)
    expect(toFriendlyProjectChatError(long, 400)).toBe(`${'x'.repeat(240)}...`)
  })
})

describe('shouldResetProjectChatSession', () => {
  it('returns true for timeout and unavailable messages', () => {
    expect(shouldResetProjectChatSession('gateway timeout from upstream')).toBe(true)
    expect(shouldResetProjectChatSession('service unavailable right now')).toBe(true)
  })

  it('returns false for regular assistant text', () => {
    expect(shouldResetProjectChatSession('Here is a summary of your milestones.')).toBe(false)
  })
})
