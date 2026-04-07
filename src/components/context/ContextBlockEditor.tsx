'use client'

import { useState, useEffect, useRef } from 'react'
import { Paperclip, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { MAX_CONTEXT_ATTACHMENT_BYTES } from '@/lib/context/attachments'
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

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
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
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
    setAttachment(null)
    setError('')
  }, [editingBlock])

  useEffect(() => {
    if (!attachment || !attachment.type.startsWith('image/')) {
      setAttachmentPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(attachment)
    setAttachmentPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [attachment])

  function setAttachmentFromFile(file: File | null) {
    if (!file) {
      setAttachment(null)
      return
    }

    if (file.size > MAX_CONTEXT_ATTACHMENT_BYTES) {
      setError('Attachment must be 20MB or smaller.')
      return
    }

    setError('')
    setAttachment(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      setError('Title and description are required.')
      return
    }

    if (attachment && attachment.size > MAX_CONTEXT_ATTACHMENT_BYTES) {
      setError('Attachment must be 20MB or smaller.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const url = editingBlock
        ? `/api/v1/projects/${projectId}/context/${editingBlock.id}`
        : `/api/v1/projects/${projectId}/context`
      const method = editingBlock ? 'PUT' : 'POST'
      const formData = new FormData()
      formData.set('title', title.trim())
      formData.set('body', body.trim())
      formData.set('block_type', blockType)
      if (attachment) formData.set('attachment', attachment)

      const res = await fetch(url, {
        method,
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
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

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    const file = e.dataTransfer.files?.[0] ?? null
    setAttachmentFromFile(file)
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
          placeholder="Description (required)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none resize-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />

        <div className="space-y-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">
            Attachment (optional, any file type)
          </label>
          <div
            onDragEnter={(e) => {
              e.preventDefault()
              setIsDragActive(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragActive(false)
            }}
            onDrop={handleDrop}
            className={cn(
              'rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 transition-colors dark:border-zinc-700 dark:bg-zinc-800',
              isDragActive && 'border-zinc-500 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-700'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => setAttachmentFromFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach file
            </button>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              or drag and drop here (max 20MB)
            </p>
          </div>
          {editingBlock?.attachment_name && !attachment && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Current file: {editingBlock.attachment_name}
            </p>
          )}
          {attachment && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {attachment.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {attachment.type || 'Unknown type'} • {formatFileSize(attachment.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {attachmentPreviewUrl && (
                <div className="mt-2 overflow-hidden rounded border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachmentPreviewUrl}
                    alt={attachment.name}
                    className="max-h-56 w-full object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </div>

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
