export default function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Avatar + name/title/brand */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
        <div className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>

      {/* Skills row */}
      <div className="flex gap-2">
        <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* Projects section */}
      <div className="space-y-3">
        <div className="h-5 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex items-center gap-3">
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>
    </div>
  )
}
