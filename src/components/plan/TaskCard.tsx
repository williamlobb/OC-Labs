'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { Task, TaskStatus } from '@/types'

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
  blocked: 'todo',
}

interface TeamMember {
  user_id: string
  name: string
}

interface TaskCardProps {
  task: Task
  allTasks: Task[]
  teamMembers: TeamMember[]
  canEdit: boolean
  unresolvedDependencyCount: number
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onAssign: (taskId: string, assigneeId: string | null) => void
  onAgentToggle: (taskId: string, value: boolean) => void
  onDependenciesChange: (taskId: string, dependsOnIds: string[]) => void
  onInspect: (taskId: string) => void
}

export function TaskCard({
  task,
  allTasks,
  teamMembers,
  canEdit,
  unresolvedDependencyCount,
  onStatusChange,
  onAssign,
  onAgentToggle,
  onDependenciesChange,
  onInspect,
}: TaskCardProps) {
  const [dependencyToAdd, setDependencyToAdd] = useState('')
  const [showDepPicker, setShowDepPicker] = useState(false)

  const dependencyOptions = useMemo(() => {
    const currentDependencies = new Set(task.depends_on ?? [])
    return allTasks.filter((candidate) => (
      candidate.id !== task.id && !currentDependencies.has(candidate.id)
    ))
  }, [allTasks, task.depends_on, task.id])

  const dependencies = useMemo(() => {
    const taskById = new Map(allTasks.map((candidate) => [candidate.id, candidate]))
    return (task.depends_on ?? []).map((dependencyId) => ({
      id: dependencyId,
      task: taskById.get(dependencyId),
    }))
  }, [allTasks, task.depends_on])

  const nextStatus = STATUS_CYCLE[task.status as TaskStatus] ?? 'todo'
  const statusButtonDisabled = nextStatus === 'done' && unresolvedDependencyCount > 0

  function handleAddDependency() {
    if (!dependencyToAdd) return
    const nextDependencies = Array.from(new Set([...(task.depends_on ?? []), dependencyToAdd]))
    onDependenciesChange(task.id, nextDependencies)
    setDependencyToAdd('')
  }

  function handleRemoveDependency(dependencyId: string) {
    const nextDependencies = (task.depends_on ?? []).filter((currentId) => currentId !== dependencyId)
    onDependenciesChange(task.id, nextDependencies)
  }

  return (
    <div className="flex flex-col h-[260px] rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header — click to inspect */}
      <button
        type="button"
        onClick={() => onInspect(task.id)}
        className="group flex w-full items-start justify-between gap-2 text-left"
      >
        <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-100 dark:group-hover:text-zinc-300">
          {task.title}
        </p>
        {task.assigned_to_agent && (
          <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
            Agent
          </span>
        )}
      </button>

      {/* Body */}
      {task.body && (
        <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{task.body}</p>
      )}

      {/* Dependency tags */}
      <div className="mt-2 flex flex-wrap gap-1 overflow-hidden max-h-[44px]">
        {dependencies.map((dep) => (
          <span
            key={dep.id}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <span className="max-w-[100px] truncate">{dep.task?.title ?? 'Missing'}</span>
            {canEdit && (
              <button
                type="button"
                onClick={() => handleRemoveDependency(dep.id)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 leading-none"
                aria-label="Remove dependency"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {canEdit && dependencyOptions.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDepPicker((v) => !v)}
            className="rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-600 dark:hover:border-zinc-400"
          >
            + dep
          </button>
        )}
      </div>

      {/* Inline dependency picker */}
      {showDepPicker && canEdit && (
        <div className="mt-1 flex items-center gap-1">
          <select
            value={dependencyToAdd}
            onChange={(e) => setDependencyToAdd(e.target.value)}
            className="min-w-0 flex-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="">Pick task…</option>
            {dependencyOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!dependencyToAdd}
            onClick={() => { handleAddDependency(); setShowDepPicker(false) }}
            className={cn(
              'shrink-0 rounded px-2 py-0.5 text-xs transition-colors',
              dependencyToAdd
                ? 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900'
                : 'cursor-not-allowed text-zinc-300'
            )}
          >
            Add
          </button>
        </div>
      )}

      {/* Spacer pushes footer to bottom */}
      <div className="flex-1" />

      {/* Footer: status + assignee */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <p
          className={cn(
            'text-xs font-medium',
            unresolvedDependencyCount > 0
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-emerald-700 dark:text-emerald-400'
          )}
        >
          {unresolvedDependencyCount > 0
            ? `Blocked by ${unresolvedDependencyCount}`
            : 'Ready now'}
        </p>

        {canEdit && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onStatusChange(task.id, task.status === 'blocked' ? 'todo' : 'blocked')}
              className={cn(
                'rounded-full px-2 py-0.5 text-xs transition-colors',
                task.status === 'blocked'
                  ? 'bg-red-100 text-red-700'
                  : 'text-zinc-400 hover:text-zinc-600'
              )}
            >
              {task.status === 'blocked' ? 'Unblock' : 'Block'}
            </button>

            <select
              value={task.assignee_id ?? ''}
              onChange={(e) => onAssign(task.id, e.target.value || null)}
              className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => onAgentToggle(task.id, !task.assigned_to_agent)}
              className={cn(
                'rounded-full px-2 py-0.5 text-xs transition-colors',
                task.assigned_to_agent
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-zinc-400 hover:text-zinc-600'
              )}
            >
              Agent
            </button>
          </div>
        )}
      </div>

      {/* Status button full-width at bottom */}
      {canEdit && (
        <button
          onClick={() => {
            if (statusButtonDisabled) return
            onStatusChange(task.id, nextStatus)
          }}
          disabled={statusButtonDisabled}
          className={cn(
            'mt-2 w-full rounded-md py-1 text-xs font-medium transition-colors',
            task.status === 'todo' && 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
            task.status === 'in_progress' && 'bg-amber-100 text-amber-700 hover:bg-amber-200',
            task.status === 'done' && 'bg-green-100 text-green-700 hover:bg-green-200',
            task.status === 'blocked' && 'bg-red-100 text-red-700 hover:bg-red-200',
            statusButtonDisabled && 'cursor-not-allowed opacity-50'
          )}
          title={statusButtonDisabled ? 'Finish dependencies before marking done' : undefined}
        >
          {task.status === 'todo' && 'To do'}
          {task.status === 'in_progress' && 'In progress'}
          {task.status === 'done' && 'Done'}
          {task.status === 'blocked' && 'Blocked'}
        </button>
      )}
    </div>
  )
}
