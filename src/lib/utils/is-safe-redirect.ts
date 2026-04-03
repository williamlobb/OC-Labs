/**
 * Returns true only for relative paths that stay on the same origin.
 * Rejects absolute URLs, protocol-relative URLs (//evil.com),
 * and percent-encoded bypass attempts.
 */
export function isSafeRedirect(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url, 'http://n')
    return parsed.hostname === 'n'
  } catch {
    return false
  }
}
