export const PROJECT_CHAT_TIMEOUT_MESSAGE =
  'The project assistant timed out while processing that request. Try narrowing scope (for example: one repository, folder, or file).'

export const PROJECT_CHAT_UNAVAILABLE_MESSAGE =
  'The project assistant is temporarily unavailable. Please try again in a minute.'

const TIMEOUT_SIGNALS = [
  'function_invocation_timeout',
  'context deadline exceeded',
  'deadline exceeded',
  'timed out',
  'timeout',
  'gateway timeout',
  'request timed out',
  'exceeded max duration',
]

const UNAVAILABLE_SIGNALS = [
  'service unavailable',
  'temporarily unavailable',
  'bad gateway',
  'upstream unavailable',
  'upstream connect error',
  'could not connect',
]

export function normalizeChatErrorText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function isTimeoutLikeProjectChatError(raw: string): boolean {
  const lower = normalizeChatErrorText(raw).toLowerCase()
  return TIMEOUT_SIGNALS.some((signal) => lower.includes(signal))
}

export function isUnavailableLikeProjectChatError(raw: string): boolean {
  const lower = normalizeChatErrorText(raw).toLowerCase()
  return UNAVAILABLE_SIGNALS.some((signal) => lower.includes(signal))
}

export function toFriendlyProjectChatError(raw: string, status?: number): string {
  const text = normalizeChatErrorText(raw)

  if (isTimeoutLikeProjectChatError(text) || status === 504 || status === 524) {
    return PROJECT_CHAT_TIMEOUT_MESSAGE
  }

  if (
    isUnavailableLikeProjectChatError(text) ||
    (typeof status === 'number' && status >= 500)
  ) {
    return PROJECT_CHAT_UNAVAILABLE_MESSAGE
  }

  if (!text) return ''

  return text.length > 240 ? `${text.slice(0, 240)}...` : text
}

export function shouldResetProjectChatSession(raw: string): boolean {
  const friendly = toFriendlyProjectChatError(raw)
  return (
    friendly === PROJECT_CHAT_TIMEOUT_MESSAGE ||
    friendly === PROJECT_CHAT_UNAVAILABLE_MESSAGE
  )
}
