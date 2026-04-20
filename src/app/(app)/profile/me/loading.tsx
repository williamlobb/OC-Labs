import ProfileSkeleton from '@/components/ui/ProfileSkeleton'

export default function MyProfileLoading() {
  return (
    <div className="max-w-2xl space-y-10">
      <ProfileSkeleton />

      {/* Edit profile form skeleton */}
      <section className="space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      </section>
    </div>
  )
}
