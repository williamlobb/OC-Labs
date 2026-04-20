'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { ProjectUpdate } from '@/types'
import { ContributorChip } from '@/components/ui/ContributorChip'

interface UpdatesFeedProps {
  projectId: string
  currentUserId: string | null
  updates: ProjectUpdate[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function UpdatesFeed({ projectId, currentUserId, updates }: UpdatesFeedProps) {
  const [items, setItems] = useState<ProjectUpdate[]>(updates)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftBody, setDraftBody] = useState('')
  const [draftMilestone, setDraftMilestone] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setItems(updates)
  }, [updates])

  function startEditing(update: ProjectUpdate) {
    setEditingId(update.id)
    setDraftBody(update.body)
    setDraftMilestone(update.milestone)
    setError(null)
  }

  function stopEditing() {
    setEditingId(null)
    setDraftBody('')
    setDraftMilestone(false)
    setError(null)
  }

  async function handleSave(updateId: string) {
    const nextBody = draftBody.trim()
    if (!nextBody) {
      setError('Update text is required.')
      return
    }

    setSavingId(updateId)
    setError(null)

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/updates/${updateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: nextBody,
          milestone: draftMilestone,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Unable to save update.')
        return
      }

      const saved = await res.json() as ProjectUpdate
      setItems((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
      stopEditing()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(update: ProjectUpdate) {
    if (!window.confirm('Delete this update? This action cannot be undone.')) return

    setDeletingId(update.id)
    setError(null)

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/updates/${update.id}`, {
        method: 'DELETE',
      })

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Unable to delete update.')
        return
      }

      setItems((prev) => prev.filter((item) => item.id !== update.id))
      if (editingId === update.id) stopEditing()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No updates yet.</p>
  }

  return (
    <div className="space-y-2">
      {error && !editingId && <p className="text-xs text-red-600">{error}</p>}
      <ol className="space-y-4">
        {items.map((update) => {
          const isOwner = Boolean(currentUserId) && update.author_id === currentUserId
          const isEditing = editingId === update.id
          const isSaving = savingId === update.id
          const isDeleting = deletingId === update.id

          return (
            <li key={update.id} className="flex gap-3">
              <div className="mt-1 flex-shrink-0">
                {update.milestone ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs"
                    title="Milestone"
                  >
                    ★
                  </span>
                ) : (
                  <span className="mt-1.5 block h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                {isEditing ? (
                  <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
                    <textarea
                      value={draftBody}
                      onChange={(event) => setDraftBody(event.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={draftMilestone}
                        onChange={(event) => setDraftMilestone(event.target.checked)}
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      Mark as milestone
                    </label>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSave(update.id)}
                        disabled={isSaving}
                        className={cn(
                          'rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200',
                          isSaving && 'cursor-not-allowed opacity-60'
                        )}
                      >
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={stopEditing}
                        disabled={isSaving}
                        className="rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{update.body}</p>
                )}

                <div className="flex items-center gap-2">
                  <ContributorChip
                    authorId={update.author_id}
                    authorName={update.author_name}
                  />
                  <span className="text-xs text-zinc-400">{formatDate(update.posted_at)}</span>
                  {isOwner && !isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEditing(update)}
                        className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(update)}
                        disabled={isDeleting}
                        className={cn(
                          'text-xs text-zinc-400 hover:text-red-600 rounded px-1.5 py-0.5 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer',
                          isDeleting && 'cursor-not-allowed opacity-60'
                        )}
                      >
                        {isDeleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
