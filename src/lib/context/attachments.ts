export const CONTEXT_ATTACHMENTS_BUCKET = 'context-block-attachments'
export const MAX_CONTEXT_ATTACHMENT_BYTES = 20 * 1024 * 1024

function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')

  return sanitized.slice(0, 120) || 'attachment'
}

export function buildContextAttachmentPath(projectId: string, filename: string): string {
  return `${projectId}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`
}

export function buildContextAttachmentUrl(path: string | null | undefined): string | null {
  if (!path) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  return `${supabaseUrl}/storage/v1/object/public/${CONTEXT_ATTACHMENTS_BUCKET}/${path}`
}

export function isFileLike(value: FormDataEntryValue | null): value is File {
  return value instanceof File
}
