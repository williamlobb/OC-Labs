'use client'

import { useMemo, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'

interface HandRaiseApplicant {
  user_id: string
  name: string
  profile_photo_url?: string | null
  raised_at: string
}

interface HandRaiseRequestsProps {
  projectId: string
  initialApplicants: HandRaiseApplicant[]
}

export function HandRaiseRequests({ projectId, initialApplicants }: HandRaiseRequestsProps) {
  const [applicants, setApplicants] = useState(initialApplicants)
  const [pendingByUser, setPendingByUser] = useState<Record<string, boolean>>({})
  const [errorByUser, setErrorByUser] = useState<Record<string, string>>({})

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    []
  )

  async function handleApprove(userId: string) {
    if (pendingByUser[userId]) return

    setPendingByUser((prev) => ({ ...prev, [userId]: true }))
    setErrorByUser((prev) => {
      const next = { ...prev }
      delete next[userId]
      return next
    })

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/hand-raises/${userId}/approve`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setErrorByUser((prev) => ({
          ...prev,
          [userId]: data?.error ?? 'Could not approve this request',
        }))
        return
      }

      setApplicants((prev) => prev.filter((member) => member.user_id !== userId))
    } catch {
      setErrorByUser((prev) => ({
        ...prev,
        [userId]: 'Network error while approving request',
      }))
    } finally {
      setPendingByUser((prev) => ({ ...prev, [userId]: false }))
    }
  }

  if (applicants.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
        No pending hand raises right now.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {applicants.map((member) => (
        <li
          key={member.user_id}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                userId={member.user_id}
                name={member.name}
                photoUrl={member.profile_photo_url ?? null}
                size="md"
              />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{member.name}</p>
                <p className="text-xs text-zinc-500">
                  Raised hand {formatter.format(new Date(member.raised_at))}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleApprove(member.user_id)}
              disabled={!!pendingByUser[member.user_id]}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                pendingByUser[member.user_id]
                  ? 'cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60'
              )}
            >
              {pendingByUser[member.user_id] ? 'Approving...' : 'Approve'}
            </button>
          </div>

          {errorByUser[member.user_id] && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errorByUser[member.user_id]}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
