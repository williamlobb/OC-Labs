'use client'

import { useState } from 'react'
import { ContextBlockList } from './ContextBlockList'
import { ContextBlockEditor } from './ContextBlockEditor'
import type { ContextBlock } from '@/types'

interface ContextWorkbenchProps {
  projectId: string
  initialBlocks: ContextBlock[]
  currentUserId: string | null
  canCreate: boolean
}

export function ContextWorkbench({ projectId, initialBlocks, currentUserId, canCreate }: ContextWorkbenchProps) {
  const [blocks, setBlocks] = useState<ContextBlock[]>(initialBlocks)
  const [showEditor, setShowEditor] = useState(false)
  const [editingBlock, setEditingBlock] = useState<ContextBlock | null>(null)

  function handleSaved(block: ContextBlock) {
    if (editingBlock) {
      setBlocks((prev) => prev.map((b) => (b.id === block.id ? block : b)))
    } else {
      setBlocks((prev) => [...prev, block])
    }
    setShowEditor(false)
    setEditingBlock(null)
  }

  function handleEdit(block: ContextBlock) {
    if (!currentUserId || block.author_id !== currentUserId) return
    setEditingBlock(block)
    setShowEditor(true)
  }

  async function handleDelete(blockId: string) {
    const block = blocks.find((item) => item.id === blockId)
    if (!block || !currentUserId || block.author_id !== currentUserId) return

    const res = await fetch(`/api/v1/projects/${projectId}/context/${blockId}`, {
      method: 'DELETE',
    })
    if (res.ok || res.status === 204) {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    }
  }

  function handleCancel() {
    setShowEditor(false)
    setEditingBlock(null)
  }

  return (
    <div className="space-y-4">
      <ContextBlockList
        blocks={blocks}
        currentUserId={currentUserId}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {blocks.length === 0 && !showEditor && (
        <div className="rounded-lg border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">No context blocks yet.</p>
          {canCreate && (
            <button
              onClick={() => setShowEditor(true)}
              className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Add first block
            </button>
          )}
        </div>
      )}

      {showEditor ? (
        <ContextBlockEditor
          projectId={projectId}
          editingBlock={editingBlock}
          onSaved={handleSaved}
          onCancel={handleCancel}
        />
      ) : (
        canCreate &&
        blocks.length > 0 && (
          <button
            onClick={() => setShowEditor(true)}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            + Add block
          </button>
        )
      )}
    </div>
  )
}
