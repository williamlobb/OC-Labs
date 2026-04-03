'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface ProjectActionsProps {
  projectId: string
  initialVoteCount: number
  initialHasVoted: boolean
  initialHasJoined: boolean
  isOwner: boolean
}

export function ProjectActions({
  projectId,
  initialVoteCount,
  initialHasVoted,
  initialHasJoined,
  isOwner,
}: ProjectActionsProps) {
  const [voteCount, setVoteCount] = useState(initialVoteCount)
  const [hasVoted, setHasVoted] = useState(initialHasVoted)
  const [hasJoined, setHasJoined] = useState(initialHasJoined)
  const [votePending, setVotePending] = useState(false)
  const [joinPending, setJoinPending] = useState(false)

  async function handleVote() {
    if (votePending) return
    // Capture pre-toggle state so revert branches use the correct direction
    const wasVoted = hasVoted
    // Optimistic update
    setHasVoted(!wasVoted)
    setVoteCount((c) => (wasVoted ? c - 1 : c + 1))
    setVotePending(true)
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/vote`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setVoteCount(data.voteCount)
        setHasVoted(data.hasVoted)
      } else {
        // Revert on error
        setHasVoted(wasVoted)
        setVoteCount((c) => (wasVoted ? c + 1 : c - 1))
      }
    } catch {
      setHasVoted(wasVoted)
      setVoteCount((c) => (wasVoted ? c + 1 : c - 1))
    } finally {
      setVotePending(false)
    }
  }

  async function handleJoin() {
    if (joinPending) return
    // Optimistic update
    setHasJoined((j) => !j)
    setJoinPending(true)
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/raise-hand`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setHasJoined(data.hasJoined)
      } else {
        setHasJoined((j) => !j)
      }
    } catch {
      setHasJoined((j) => !j)
    } finally {
      setJoinPending(false)
    }
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={handleVote}
        disabled={votePending}
        className={cn(
          'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          hasVoted
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
        )}
      >
        ▲ {hasVoted ? 'Voted' : 'Vote'} ({voteCount})
      </button>

      {!isOwner && (
        <button
          onClick={handleJoin}
          disabled={joinPending}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            hasJoined
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          )}
        >
          {hasJoined ? 'Joined ✓' : 'Raise Hand'}
        </button>
      )}
    </div>
  )
}
