'use client'

import { FilterChips } from './FilterChips'
import type { ProjectStatus } from '@/types'

interface BoardToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: ProjectStatus | null
  onStatusChange: (status: ProjectStatus | null) => void
}

export function BoardToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
}: BoardToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input
        type="search"
        placeholder="Search projects…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 sm:max-w-xs"
      />
      <FilterChips selected={statusFilter} onChange={onStatusChange} />
    </div>
  )
}
