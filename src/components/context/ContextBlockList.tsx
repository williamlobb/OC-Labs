import { Badge } from '@/components/ui/Badge'
import type { ContextBlock, BlockType } from '@/types'

const BLOCK_TYPE_VARIANTS: Record<BlockType, 'blue' | 'purple' | 'amber' | 'red' | 'default'> = {
  architecture: 'blue',
  decision: 'purple',
  constraint: 'red',
  general: 'default',
}

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  architecture: 'Architecture',
  decision: 'Decision',
  constraint: 'Constraint',
  general: 'General',
}

interface ContextBlockListProps {
  blocks: ContextBlock[]
  canEdit: boolean
  onEdit: (block: ContextBlock) => void
  onDelete: (blockId: string) => void
}

function getAttachmentExtension(name: string | null | undefined): string {
  if (!name) return ''
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] ?? '' : ''
}

function isImageAttachment(block: ContextBlock): boolean {
  const mime = block.attachment_mime_type?.toLowerCase() ?? ''
  if (mime.startsWith('image/')) return true
  const extension = getAttachmentExtension(block.attachment_name)
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(extension)
}

function isPdfAttachment(block: ContextBlock): boolean {
  const mime = block.attachment_mime_type?.toLowerCase() ?? ''
  if (mime === 'application/pdf') return true
  return getAttachmentExtension(block.attachment_name) === 'pdf'
}

function formatFileSize(sizeBytes: number | null | undefined): string | null {
  if (!sizeBytes || sizeBytes <= 0) return null
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ContextBlockList({ blocks, canEdit, onEdit, onDelete }: ContextBlockListProps) {
  if (blocks.length === 0) return null

  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <div
          key={block.id}
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant={BLOCK_TYPE_VARIANTS[block.block_type as BlockType] ?? 'default'}>
                {BLOCK_TYPE_LABELS[block.block_type as BlockType] ?? block.block_type}
              </Badge>
              <h3 className="text-sm font-semibold text-zinc-900 truncate dark:text-zinc-100">
                {block.title}
              </h3>
              {block.version > 1 && (
                <span className="text-xs text-zinc-400">v{block.version}</span>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onEdit(block)}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(block.id)}
                  className="text-xs text-zinc-400 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-zinc-600 whitespace-pre-wrap dark:text-zinc-400">
            {block.body}
          </p>

          {block.attachment_url && block.attachment_name && (
            <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
              <a
                href={block.attachment_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-100"
              >
                {block.attachment_name}
              </a>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {(block.attachment_mime_type ?? 'Unknown type')}
                {formatFileSize(block.attachment_size_bytes)
                  ? ` • ${formatFileSize(block.attachment_size_bytes)}`
                  : ''}
              </p>

              {isImageAttachment(block) && (
                <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={block.attachment_url}
                    alt={block.attachment_name}
                    loading="lazy"
                    className="max-h-80 w-full object-contain bg-white dark:bg-zinc-900"
                  />
                </div>
              )}

              {isPdfAttachment(block) && (
                <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  <iframe
                    src={block.attachment_url}
                    title={block.attachment_name}
                    className="h-80 w-full"
                  />
                </div>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-zinc-400">
            Added by {block.author_name || 'Unknown'} on{' '}
            {new Date(block.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}
