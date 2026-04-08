import { avatarColor } from '@/lib/utils/avatar'

interface ContributorChipProps {
  authorId?: string | null
  authorName?: string | null
  isAgent?: boolean
}

export function ContributorChip({ authorId, authorName, isAgent }: ContributorChipProps) {
  const displayName = authorName || 'Unknown'
  const agent = isAgent || authorName === 'Omnia Agent'

  if (agent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
        <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <path d="M6 0l1.5 4.5H12L8.25 7.5 9.75 12 6 9 2.25 12l1.5-4.5L0 4.5h4.5z" />
        </svg>
        {displayName}
      </span>
    )
  }

  const { bg, fg } = avatarColor(authorId ?? '')
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
        style={{ backgroundColor: bg, color: fg }}
        aria-hidden="true"
      >
        {initials}
      </span>
      {displayName}
    </span>
  )
}
