'use client'

import { cn } from '@/lib/utils/cn'
import { StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import type { ProjectCardProps } from '@/types'

export function ProjectCard(props: ProjectCardProps) {
  const {
    title,
    brand,
    status,
    desc,
    skills,
    owner,
    voteCount,
    hasVoted,
    hasJoined,
    needsHelp,
    onVote,
    onJoin,
    onClick,
  } = props

  return (
    <article
      role="article"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900',
        needsHelp && 'ring-2 ring-red-400'
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <StatusBadge status={status} />
        <span className="text-xs text-zinc-500">{brand}</span>
      </div>

      {/* Needs help banner */}
      {needsHelp && (
        <div
          data-testid="needs-help-banner"
          className="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"
        >
          Needs help
        </div>
      )}

      {/* Title */}
      <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-1 text-sm text-zinc-600 line-clamp-2 dark:text-zinc-400">
        {desc}
      </p>

      {/* Skills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {skill}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
        {/* Owner */}
        <div className="flex items-center">
          <Avatar userId={owner.id} name={owner.name} size="sm" />
          <span className="ml-2 text-sm text-zinc-600">{owner.name}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            aria-label="Vote"
            onClick={(e) => { e.stopPropagation(); onVote() }}
            className={cn(
              'flex items-center gap-1 text-sm transition-colors',
              hasVoted ? 'font-semibold text-blue-600' : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z"
                clipRule="evenodd"
              />
            </svg>
            {voteCount}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onJoin() }}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              hasJoined
                ? 'bg-blue-100 text-blue-700'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            )}
          >
            {hasJoined ? 'Joined' : 'Join'}
          </button>
        </div>
      </div>
    </article>
  )
}
