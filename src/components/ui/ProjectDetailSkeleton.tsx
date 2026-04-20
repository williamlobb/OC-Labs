export default function ProjectDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Main content — left 2 columns */}
      <div className="lg:col-span-2 space-y-8">
        {/* Repositories section */}
        <section className="space-y-3">
          <div className="h-5 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-16 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-16 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" />
        </section>

        {/* Updates section */}
        <section className="space-y-4">
          <div className="h-5 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />

          {/* Textarea skeleton */}
          <div className="h-24 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />

          {/* Update line items */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        </section>
      </div>

      {/* Sidebar */}
      <aside className="space-y-6">
        {/* Team section */}
        <section className="space-y-3">
          <div className="h-5 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </section>

        {/* Risk section */}
        <section className="space-y-3">
          <div className="h-5 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-9 w-36 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        </section>
      </aside>
    </div>
  )
}
