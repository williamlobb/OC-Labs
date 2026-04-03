/**
 * Returns true only for relative paths that stay on the same origin.
 * Rejects absolute URLs, protocol-relative URLs (//evil.com),
 * whitespace-only strings, bare hostnames, and percent-encoded bypass attempts.
 */
export function isSafeRedirect(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  // Must be root-relative — bare strings like 'evil.com/path' are not safe
  if (!trimmed.startsWith('/')) return false
  try {
    const parsed = new URL(trimmed, 'http://n')
    return parsed.hostname === 'n'
  } catch {
    return false
  }
}
