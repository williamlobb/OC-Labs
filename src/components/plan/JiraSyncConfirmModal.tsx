'use client'

import { cn } from '@/lib/utils/cn'

interface JiraSyncConfirmModalProps {
  unassignedTaskCount: number
  unassignedTaskPreview: string[]
  syncing: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export function JiraSyncConfirmModal({
  unassignedTaskCount,
  unassignedTaskPreview,
  syncing,
  onCancel,
  onConfirm,
}: JiraSyncConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !syncing) {
          onCancel()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="jira-sync-confirm-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="space-y-2">
          <h2
            id="jira-sync-confirm-title"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Some tasks are still unassigned
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            These tasks do not have a teammate assigned yet. You can still sync them, but Jira will receive issues without owners.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100">
          {unassignedTaskCount === 1
            ? '1 task is unassigned.'
            : `${unassignedTaskCount} tasks are unassigned.`}
        </div>

        {unassignedTaskPreview.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Preview
            </p>
            <div className="mt-2 space-y-1">
              {unassignedTaskPreview.map((title) => (
                <p
                  key={title}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {title}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={syncing}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={syncing}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors',
              syncing
                ? 'cursor-not-allowed bg-zinc-500'
                : 'bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
            )}
          >
            {syncing ? 'Syncing…' : 'Sync anyway'}
          </button>
        </div>
      </div>
    </div>
  )
}
