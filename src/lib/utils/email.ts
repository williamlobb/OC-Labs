export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function emailsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeEmail(a)
  const right = normalizeEmail(b)

  if (!left || !right) return false
  return left === right
}
