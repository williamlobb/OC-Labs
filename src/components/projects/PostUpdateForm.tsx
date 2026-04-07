'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface PostUpdateFormProps {
  projectId: string
  initialBody?: string
  autoFocus?: boolean
}

export function PostUpdateForm({ projectId, initialBody = '', autoFocus = false }: PostUpdateFormProps) {
  const router = useRouter()
  const [body, setBody] = useState(initialBody)
  const [milestone, setMilestone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setBody(initialBody)
  }, [initialBody])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedBody = body.trim()
    if (!trimmedBody) {
      setError('Write a short update before posting.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: trimmedBody,
          milestone,
        }),
      })

      if (!response.ok) {
        const responseBody = await response.json().catch(() => ({}))
        setError(responseBody.error ?? 'Unable to post update right now.')
        return
      }

      setBody('')
      setMilestone(false)
      setSuccess('Update posted.')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Post update</h3>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={milestone}
            onChange={(event) => setMilestone(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          Mark as milestone
        </label>
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        autoFocus={autoFocus}
        rows={4}
        placeholder="Share what changed, what is blocked, or what help is needed."
        className="mt-3 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {success && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{success}</p>}

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200',
            submitting && 'cursor-not-allowed opacity-60'
          )}
        >
          {submitting ? 'Posting…' : 'Post update'}
        </button>
      </div>
    </form>
  )
}
