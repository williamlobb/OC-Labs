'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'

interface Submission {
  id: string
  title: string
  summary: string | null
  status: string
  created_at: string
  owner_name: string
  owner_email: string | null
  skills_needed: string[]
}

interface Props {
  submissions: Submission[]
}

type SubmissionAction = 'approve' | 'reject'

export default function SubmissionsQueuePanel({ submissions }: Props) {
  const router = useRouter()
  const [pendingById, setPendingById] = useState<Record<string, SubmissionAction | null>>({})
  const [errorById, setErrorById] = useState<Record<string, string | null>>({})

  async function handleAction(projectId: string, action: SubmissionAction) {
    if (pendingById[projectId]) return

    setPendingById((prev) => ({ ...prev, [projectId]: action }))
    setErrorById((prev) => ({ ...prev, [projectId]: null }))

    try {
      const res = await fetch(`/api/v1/admin/submissions/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to update submission')
      }

      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update submission'
      setErrorById((prev) => ({ ...prev, [projectId]: message }))
    } finally {
      setPendingById((prev) => ({ ...prev, [projectId]: null }))
    }
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-500">
        No pending submissions right now.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {submissions.map((submission) => (
        <article
          key={submission.id}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="blue">{submission.status}</Badge>
                <span className="text-xs text-zinc-500">
                  Submitted {new Date(submission.created_at).toLocaleString()}
                </span>
              </div>
              <h2 className="text-base font-semibold text-zinc-900">{submission.title}</h2>
              <p className="text-sm text-zinc-600">
                By {submission.owner_name}
                {submission.owner_email ? ` (${submission.owner_email})` : ''}
              </p>
              {submission.summary ? (
                <p className="text-sm text-zinc-700">{submission.summary}</p>
              ) : null}
              {submission.skills_needed.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {submission.skills_needed.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : null}
              {errorById[submission.id] ? (
                <p className="text-xs text-red-600">{errorById[submission.id]}</p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/projects/${submission.id}`}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Open
              </Link>
              <button
                onClick={() => handleAction(submission.id, 'reject')}
                disabled={!!pendingById[submission.id]}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
              >
                {pendingById[submission.id] === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
              <button
                onClick={() => handleAction(submission.id, 'approve')}
                disabled={!!pendingById[submission.id]}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
              >
                {pendingById[submission.id] === 'approve' ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
