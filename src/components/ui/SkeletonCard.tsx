export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-2 space-y-1.5">
        <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-14 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  )
}
