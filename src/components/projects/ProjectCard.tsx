'use client'

import { cn } from '@/lib/utils/cn'
import { StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import type { ProjectCardProps } from '@/types'

type TeamPreviewMember = {
  id: string
  name: string
  profilePhotoUrl?: string | null
}

type ProjectCardViewProps = ProjectCardProps & {
  teamMembers?: TeamPreviewMember[]
}

export function ProjectCard(props: ProjectCardViewProps) {
  const {
    title,
    brand,
    status,
    desc,
    skills,
    owner,
    teamMembers = [],
    voteCount,
    hasVoted,
    hasJoined,
    needsHelp,
    onVote,
    onJoin,
    onClick,
  } = props
  const teamWithOwner = [{ id: owner.id, name: owner.name }, ...teamMembers].filter((member) =>
    Boolean(member.id)
  )
  const uniqueTeamMembers = Array.from(
    new Map(teamWithOwner.map((member) => [member.id, member])).values()
  )
  const visibleTeamMembers = uniqueTeamMembers.slice(0, 6)
  const extraTeamCount = Math.max(0, uniqueTeamMembers.length - visibleTeamMembers.length)
  const joinButtonLabel = hasJoined ? 'Joined' : needsHelp ? 'We need you' : 'Request to join'

  return (
    <article
      role="article"
      onClick={onClick}
      className={cn(
        'flex h-[18rem] w-full cursor-pointer flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900',
        needsHelp && 'ring-2 ring-red-400'
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <StatusBadge status={status} />
        <span className="max-w-[45%] truncate text-right text-xs text-zinc-500">{brand}</span>
      </div>

      {/* Title */}
      <h3 className="font-heading mt-1.5 line-clamp-1 min-h-6 text-base font-bold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-1 min-h-10 text-sm text-zinc-600 line-clamp-2 dark:text-zinc-400">
        {desc}
      </p>

      {/* Skills */}
      <div className="mt-2.5 h-11 overflow-hidden">
        <div className="flex flex-wrap content-start gap-1.5">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-3">
        <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <div className="flex items-center">
            {visibleTeamMembers.map((member, index) => (
              <div
                key={member.id}
                title={member.name}
                aria-label={member.name}
                className={cn(index > 0 && '-ml-1.5')}
              >
                <Avatar
                  userId={member.id}
                  name={member.name}
                  photoUrl={member.profilePhotoUrl ?? null}
                  size="sm"
                  className="h-6 w-6 text-[10px] ring-2 ring-white dark:ring-zinc-900"
                />
              </div>
            ))}
            {extraTeamCount > 0 && (
              <span className="ml-1 text-xs text-zinc-500">+{extraTeamCount}</span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center justify-between gap-2">
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
                  : needsHelp
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              )}
            >
              {joinButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
