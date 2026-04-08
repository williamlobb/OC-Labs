import type { ProjectUpdate } from '@/types'
import { ContributorChip } from '@/components/ui/ContributorChip'

interface UpdatesFeedProps {
  updates: ProjectUpdate[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function UpdatesFeed({ updates }: UpdatesFeedProps) {
  if (updates.length === 0) {
    return <p className="text-sm text-zinc-500">No updates yet.</p>
  }

  return (
    <ol className="space-y-4">
      {updates.map((update) => (
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
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{update.body}</p>
            <div className="flex items-center gap-2">
              <ContributorChip
                authorId={update.author_id}
                authorName={update.author_name}
              />
              <span className="text-xs text-zinc-400">{formatDate(update.posted_at)}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
