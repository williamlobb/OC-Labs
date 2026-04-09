import { isSafeRedirect } from '@/lib/utils/is-safe-redirect'

const INVITATION_ACCEPT_PATH = /^\/api\/v1\/invitations\/([^/]+)\/accept$/

export function extractInvitationTokenFromRedirect(
  redirectTo: string | null | undefined
): string | null {
  if (!redirectTo || !isSafeRedirect(redirectTo)) return null

  try {
    const parsed = new URL(redirectTo, 'http://n')
    const match = parsed.pathname.match(INVITATION_ACCEPT_PATH)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export function isInvitationRedirect(redirectTo: string | null | undefined): boolean {
  return extractInvitationTokenFromRedirect(redirectTo) !== null
}
