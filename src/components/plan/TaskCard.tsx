'use client'

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
  teamMembers: TeamMember[]
  canEdit: boolean
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onAssign: (taskId: string, assigneeId: string | null) => void
  onAgentToggle: (taskId: string, value: boolean) => void
}

export function TaskCard({
  task,
  teamMembers,
  canEdit,
  onStatusChange,
  onAssign,
  onAgentToggle,
}: TaskCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
          {task.title}
        </p>
        {task.assigned_to_agent && (
          <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
            Agent
          </span>
        )}
      </div>

      {task.body && (
        <p className="mt-1 text-xs text-zinc-500 line-clamp-2 dark:text-zinc-400">{task.body}</p>
      )}

      {canEdit && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onStatusChange(task.id, STATUS_CYCLE[task.status as TaskStatus] ?? 'todo')}
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
              task.status === 'todo' && 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
              task.status === 'in_progress' && 'bg-amber-100 text-amber-700 hover:bg-amber-200',
              task.status === 'done' && 'bg-green-100 text-green-700 hover:bg-green-200',
              task.status === 'blocked' && 'bg-red-100 text-red-700 hover:bg-red-200'
            )}
          >
            {task.status === 'todo' && 'To do'}
            {task.status === 'in_progress' && 'In progress'}
            {task.status === 'done' && 'Done'}
            {task.status === 'blocked' && 'Blocked'}
          </button>

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
            className="ml-auto rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
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
            {task.assigned_to_agent ? 'Agent ✓' : 'Agent'}
          </button>
        </div>
      )}
    </div>
  )
}
