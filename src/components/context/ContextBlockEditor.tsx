'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import type { ContextBlock, BlockType } from '@/types'

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'decision', label: 'Decision' },
  { value: 'constraint', label: 'Constraint' },
]

interface ContextBlockEditorProps {
  projectId: string
  editingBlock?: ContextBlock | null
  onSaved: (block: ContextBlock) => void
  onCancel: () => void
}

export function ContextBlockEditor({
  projectId,
  editingBlock,
  onSaved,
  onCancel,
}: ContextBlockEditorProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [blockType, setBlockType] = useState<BlockType>('general')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editingBlock) {
      setTitle(editingBlock.title)
      setBody(editingBlock.body)
      setBlockType((editingBlock.block_type as BlockType) ?? 'general')
    } else {
      setTitle('')
      setBody('')
      setBlockType('general')
    }
    setError('')
  }, [editingBlock])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const url = editingBlock
        ? `/api/v1/projects/${projectId}/context/${editingBlock.id}`
        : `/api/v1/projects/${projectId}/context`
      const method = editingBlock ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), block_type: blockType }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong.')
        return
      }

      const saved = await res.json()
      onSaved(saved)
    } catch {
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as BlockType)}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <textarea
          placeholder="Describe the context, decision, or constraint…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none resize-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={cn(
              'rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200',
              saving && 'opacity-60 cursor-not-allowed'
            )}
          >
            {editingBlock ? 'Save' : 'Add block'}
          </button>
        </div>
      </div>
    </form>
  )
}
