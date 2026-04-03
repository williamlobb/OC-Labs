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
        </div>
      ))}
    </div>
  )
}
