'use client'

import { useState } from 'react'
import { TaskCard } from './TaskCard'
import { cn } from '@/lib/utils/cn'
import type { Task, TaskStatus } from '@/types'

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
  { status: 'blocked', label: 'Blocked' },
]

interface TeamMember {
  user_id: string
  name: string
}

interface TaskBoardProps {
  projectId: string
  initialTasks: Task[]
  teamMembers: TeamMember[]
  canEdit: boolean
}

export function TaskBoard({ projectId, initialTasks, teamMembers, canEdit }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [decomposing, setDecomposing] = useState(false)

  async function handleDecompose() {
    if (decomposing) return
    setDecomposing(true)
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/plan`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setTasks((prev) => [...prev, ...(data.tasks ?? [])])
      }
    } finally {
      setDecomposing(false)
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)))
    await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  async function handleAssign(taskId: string, assigneeId: string | null) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assignee_id: assigneeId ?? undefined } : t))
    )
    await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_id: assigneeId }),
    })
  }

  async function handleAgentToggle(taskId: string, value: boolean) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assigned_to_agent: value } : t))
    )
    await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to_agent: value }),
    })
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500">No tasks yet.</p>
        {canEdit && (
          <button
            onClick={handleDecompose}
            disabled={decomposing}
            className={cn(
              'mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200',
              decomposing && 'opacity-60 cursor-not-allowed'
            )}
          >
            {decomposing ? 'Thinking…' : 'Decompose with AI'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={handleDecompose}
            disabled={decomposing}
            className={cn(
              'rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800',
              decomposing && 'opacity-60 cursor-not-allowed'
            )}
          >
            {decomposing ? 'Thinking…' : '+ Decompose with AI'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status)
          return (
            <div key={col.status} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {col.label}
                </h3>
                <span className="text-xs text-zinc-400">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    teamMembers={teamMembers}
                    canEdit={canEdit}
                    onStatusChange={handleStatusChange}
                    onAssign={handleAssign}
                    onAgentToggle={handleAgentToggle}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-zinc-200 py-6 text-center dark:border-zinc-800">
                    <span className="text-xs text-zinc-400">Empty</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
