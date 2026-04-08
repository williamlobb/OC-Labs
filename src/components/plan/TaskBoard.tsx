'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { TaskCard } from './TaskCard'
import { TaskDetailModal } from './TaskDetailModal'
import { cn } from '@/lib/utils/cn'
import {
  BLOCKED_TASK_PROMPT_AFTER_HOURS,
  buildBlockedPromptDraft,
  formatBlockedDuration,
  getOverdueBlockedTasks,
} from '@/lib/utils/blocked-tasks'
import type { MemberRole, Task, TaskStatus } from '@/types'

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
  viewerRole: MemberRole | null
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
    depends_on: Array.isArray(task.depends_on) ? task.depends_on : [],
  }
}

export function TaskBoard({ projectId, initialTasks, teamMembers, canEdit, viewerRole }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(() => initialTasks.map(normalizeTask))
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [decomposing, setDecomposing] = useState(false)
  const [syncingToJira, setSyncingToJira] = useState(false)
  const [jiraSyncMessage, setJiraSyncMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [readyOnly, setReadyOnly] = useState(false)
  const overdueBlockedTasks = getOverdueBlockedTasks(tasks)
  const shouldPromptOwner = viewerRole === 'owner' && overdueBlockedTasks.length > 0
  const oldestBlocked = overdueBlockedTasks[0]
  const blockedPromptDraft = buildBlockedPromptDraft(overdueBlockedTasks)

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

  const unresolvedDependencyCountByTaskId = useMemo(() => {
    const unresolvedCountById = new Map<string, number>()
    for (const task of tasks) {
      const dependencies = Array.isArray(task.depends_on) ? task.depends_on : []
      const unresolvedCount = dependencies.filter((dependencyId) => {
        const dependencyTask = taskById.get(dependencyId)
        return !dependencyTask || dependencyTask.status !== 'done'
      }).length
      unresolvedCountById.set(task.id, unresolvedCount)
    }
    return unresolvedCountById
  }, [tasks, taskById])

  async function handleDecompose() {
    if (decomposing) return
    setDecomposing(true)
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/plan`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setTasks((prev) => [...prev, ...((data.tasks ?? []).map(normalizeTask))])
      }
    } finally {
      setDecomposing(false)
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    const previousTasks = tasks
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)))
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) setTasks(previousTasks)
    } catch {
      setTasks(previousTasks)
    }
  }

  async function handleAssign(taskId: string, assigneeId: string | null) {
    const previousTasks = tasks
    setTasks((prev) =>
      prev.map((task) => (
        task.id === taskId ? { ...task, assignee_id: assigneeId ?? undefined } : task
      ))
    )
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: assigneeId }),
      })
      if (!res.ok) setTasks(previousTasks)
    } catch {
      setTasks(previousTasks)
    }
  }

  async function handleAgentToggle(taskId: string, value: boolean) {
    const previousTasks = tasks
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, assigned_to_agent: value } : task))
    )
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to_agent: value }),
      })
      if (!res.ok) setTasks(previousTasks)
    } catch {
      setTasks(previousTasks)
    }
  }

  async function handleDependenciesChange(taskId: string, dependsOnIds: string[]) {
    const previousTasks = tasks
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, depends_on: dependsOnIds } : task))
    )
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depends_on: dependsOnIds }),
      })
      if (!res.ok) setTasks(previousTasks)
    } catch {
      setTasks(previousTasks)
    }
  }

  async function handleEditTask(taskId: string, updates: Partial<Pick<Task, 'title' | 'body' | 'status' | 'assignee_id' | 'assigned_to_agent' | 'depends_on'>>) {
    const previousTasks = tasks
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
    )
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        setTasks(previousTasks)
      } else {
        const updated = await res.json()
        setTasks((prev) =>
          prev.map((task) => (task.id === taskId ? normalizeTask(updated) : task))
        )
      }
    } catch {
      setTasks(previousTasks)
    }
  }

  async function handleDeleteTask(taskId: string) {
    const previousTasks = tasks
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
        method: 'DELETE',
      })
      if (!res.ok) setTasks(previousTasks)
    } catch {
      setTasks(previousTasks)
    }
  }

  async function handleSyncToJira() {
    if (syncingToJira) return

    setSyncingToJira(true)
    setJiraSyncMessage(null)

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/jira/sync`, { method: 'POST' })
      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        const error = typeof payload?.error === 'string' ? payload.error : 'Jira sync failed.'
        setJiraSyncMessage({ text: error, isError: true })
        return
      }

      const created = typeof payload?.created === 'number' ? payload.created : 0
      const skipped = typeof payload?.skipped === 'number' ? payload.skipped : 0
      const failed = typeof payload?.failed === 'number' ? payload.failed : 0
      const summary = `Jira sync: ${created} created, ${skipped} skipped, ${failed} failed.`

      setJiraSyncMessage({ text: summary, isError: failed > 0 })
    } catch {
      setJiraSyncMessage({ text: 'Jira sync failed. Please try again.', isError: true })
    } finally {
      setSyncingToJira(false)
    }
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
      {shouldPromptOwner && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-700/40 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {overdueBlockedTasks.length === 1
              ? `A task has been blocked for more than ${BLOCKED_TASK_PROMPT_AFTER_HOURS} hours.`
              : `${overdueBlockedTasks.length} tasks have been blocked for more than ${BLOCKED_TASK_PROMPT_AFTER_HOURS} hours.`}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            Post an update so contributors can help unblock the work.
            {oldestBlocked
              ? ` Oldest blocker: ${formatBlockedDuration(oldestBlocked.blockedForHours)}.`
              : ''}
          </p>
          <Link
            href={`/projects/${projectId}?compose=1&draft=${encodeURIComponent(blockedPromptDraft)}`}
            className="mt-3 inline-flex rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
          >
            Post update
          </Link>
        </section>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setReadyOnly((current) => !current)}
          className={cn(
            'rounded-md border px-3 py-1.5 text-sm',
            readyOnly
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
              : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
          )}
        >
          {readyOnly ? 'Showing ready now' : 'Show ready now only'}
        </button>

        {canEdit && (
          <button
            onClick={handleSyncToJira}
            disabled={syncingToJira}
            className={cn(
              'rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800',
              syncingToJira && 'opacity-60 cursor-not-allowed'
            )}
          >
            {syncingToJira ? 'Syncing Jira…' : 'Sync to Jira'}
          </button>
        )}

        {canEdit && (
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
        )}
      </div>

      {jiraSyncMessage && (
        <p
          className={cn(
            'text-xs',
            jiraSyncMessage.isError
              ? 'text-red-600 dark:text-red-400'
              : 'text-emerald-700 dark:text-emerald-400'
          )}
        >
          {jiraSyncMessage.text}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((task) => task.status === col.status)
          const displayedTasks = readyOnly
            ? colTasks.filter((task) => (unresolvedDependencyCountByTaskId.get(task.id) ?? 0) === 0)
            : colTasks
          return (
            <div key={col.status} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {col.label}
                </h3>
                <span className="text-xs text-zinc-400">
                  {displayedTasks.length}
                  {readyOnly && <span className="text-zinc-300">/{colTasks.length}</span>}
                </span>
              </div>
              <div className="space-y-2">
                {displayedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    allTasks={tasks}
                    teamMembers={teamMembers}
                    canEdit={canEdit}
                    unresolvedDependencyCount={unresolvedDependencyCountByTaskId.get(task.id) ?? 0}
                    onStatusChange={handleStatusChange}
                    onAssign={handleAssign}
                    onAgentToggle={handleAgentToggle}
                    onDependenciesChange={handleDependenciesChange}
                    onInspect={setSelectedTaskId}
                  />
                ))}
                {displayedTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-zinc-200 py-6 text-center dark:border-zinc-800">
                    <span className="text-xs text-zinc-400">
                      {readyOnly ? 'No ready tasks' : 'Empty'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedTaskId && (() => {
        const selectedTask = tasks.find((t) => t.id === selectedTaskId)
        if (!selectedTask) return null
        return (
          <TaskDetailModal
            task={selectedTask}
            allTasks={tasks}
            teamMembers={teamMembers}
            canEdit={canEdit}
            onClose={() => setSelectedTaskId(null)}
            onSave={handleEditTask}
            onDelete={handleDeleteTask}
          />
        )
      })()}
    </div>
  )
}
