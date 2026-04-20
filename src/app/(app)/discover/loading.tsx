import { SkeletonCard } from '@/components/ui/SkeletonCard'

export default function DiscoverLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
