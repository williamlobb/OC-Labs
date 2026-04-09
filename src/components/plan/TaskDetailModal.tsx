'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { Task, TaskStatus } from '@/types'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
]

interface TeamMember {
  user_id: string
  name: string
}

type TaskUpdates = Partial<Pick<Task, 'title' | 'body' | 'status' | 'assignee_id' | 'assigned_to_agent' | 'depends_on'>>

interface TaskDetailModalProps {
  task: Task
  allTasks: Task[]
  teamMembers: TeamMember[]
  canEdit: boolean
  startInEditMode?: boolean
  onClose: () => void
  onSave: (taskId: string, updates: TaskUpdates) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
}

export function TaskDetailModal({
  task,
  allTasks,
  teamMembers,
  canEdit,
  startInEditMode = false,
  onClose,
  onSave,
  onDelete,
}: TaskDetailModalProps) {
  const [editing, setEditing] = useState(startInEditMode && canEdit)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit draft state
  const [draftTitle, setDraftTitle] = useState(task.title)
  const [draftBody, setDraftBody] = useState(task.body ?? '')
  const [draftStatus, setDraftStatus] = useState<TaskStatus>(task.status)
  const [draftAssigneeId, setDraftAssigneeId] = useState(task.assignee_id ?? '')
  const [draftAgent, setDraftAgent] = useState(task.assigned_to_agent)
  const [draftDeps, setDraftDeps] = useState<string[]>(task.depends_on ?? [])
  const [depToAdd, setDepToAdd] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const depOptions = useMemo(() => {
    const current = new Set(draftDeps)
    return allTasks.filter((t) => t.id !== task.id && !current.has(t.id))
  }, [allTasks, draftDeps, task.id])

  const viewDependencyTasks = useMemo(() => {
    const byId = new Map(allTasks.map((t) => [t.id, t]))
    return (task.depends_on ?? []).map((id) => ({ id, task: byId.get(id) }))
  }, [allTasks, task.depends_on])

  const draftDependencyTasks = useMemo(() => {
    const byId = new Map(allTasks.map((t) => [t.id, t]))
    return draftDeps.map((id) => ({ id, task: byId.get(id) }))
  }, [allTasks, draftDeps])

  function startEdit() {
    setDraftTitle(task.title)
    setDraftBody(task.body ?? '')
    setDraftStatus(task.status)
    setDraftAssigneeId(task.assignee_id ?? '')
    setDraftAgent(task.assigned_to_agent)
    setDraftDeps(task.depends_on ?? [])
    setDepToAdd('')
    setConfirmDelete(false)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setConfirmDelete(false)
  }

  async function handleSave() {
    if (!draftTitle.trim()) return
    setSaving(true)
    try {
      await onSave(task.id, {
        title: draftTitle.trim(),
        body: draftBody.trim() || undefined,
        status: draftStatus,
        assignee_id: draftAssigneeId || undefined,
        assigned_to_agent: draftAgent,
        depends_on: draftDeps,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete(task.id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  function addDep() {
    if (!depToAdd) return
    setDraftDeps((prev) => Array.from(new Set([...prev, depToAdd])))
    setDepToAdd('')
  }

  function removeDep(id: string) {
    setDraftDeps((prev) => prev.filter((d) => d !== id))
  }

  const assigneeName = teamMembers.find((m) => m.user_id === task.assignee_id)?.name

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          {editing ? (
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          ) : (
            <h2 className="flex-1 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
              {task.title}
            </h2>
          )}

          <div className="flex shrink-0 items-center gap-1">
            {canEdit && !editing && (
              <button
                type="button"
                onClick={startEdit}
                className="rounded px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Description */}
          {editing ? (
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={3}
              placeholder="Task description…"
              className="w-full resize-none rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            />
          ) : task.body ? (
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{task.body}</p>
          ) : (
            <p className="text-xs italic text-zinc-400">No description.</p>
          )}

          {/* Fields */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {/* Status */}
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Status</p>
              {editing ? (
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as TaskStatus)}
                  className="w-full rounded border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-xs text-zinc-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              ) : (
                <span className={cn(
                  'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                  task.status === 'todo' && 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
                  task.status === 'in_progress' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                  task.status === 'done' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  task.status === 'blocked' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                )}>
                  {STATUS_OPTIONS.find((s) => s.value === task.status)?.label}
                </span>
              )}
            </div>

            {/* Assignee */}
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Assignee</p>
              {editing ? (
                <select
                  value={draftAssigneeId}
                  onChange={(e) => setDraftAssigneeId(e.target.value)}
                  className="w-full rounded border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-xs text-zinc-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                  {assigneeName ?? 'Unassigned'}
                </span>
              )}
            </div>

            {/* Agent */}
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Agent</p>
              {editing ? (
                <button
                  type="button"
                  onClick={() => setDraftAgent((v) => !v)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                    draftAgent
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                  )}
                >
                  {draftAgent ? 'Assigned' : 'Unassigned'}
                </button>
              ) : (
                <span className={cn(
                  'inline-block text-xs',
                  task.assigned_to_agent
                    ? 'font-medium text-purple-700 dark:text-purple-400'
                    : 'text-zinc-400'
                )}>
                  {task.assigned_to_agent ? 'Assigned' : 'None'}
                </span>
              )}
            </div>

            {/* Jira */}
            {task.jira_issue_key && (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Jira</p>
                {task.jira_issue_url ? (
                  <a
                    href={task.jira_issue_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {task.jira_issue_key}
                  </a>
                ) : (
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">{task.jira_issue_key}</span>
                )}
              </div>
            )}
          </div>

          {/* Dependencies */}
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Dependencies</p>
            {editing ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {draftDependencyTasks.map((dep) => (
                    <span
                      key={dep.id}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      <span className="max-w-[140px] truncate">{dep.task?.title ?? 'Unknown'}</span>
                      <button
                        type="button"
                        onClick={() => removeDep(dep.id)}
                        className="leading-none text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        aria-label="Remove dependency"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {depOptions.length > 0 && (
                  <div className="flex items-center gap-1">
                    <select
                      value={depToAdd}
                      onChange={(e) => setDepToAdd(e.target.value)}
                      className="min-w-0 flex-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-xs text-zinc-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      <option value="">Add dependency…</option>
                      {depOptions.map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!depToAdd}
                      onClick={addDep}
                      className={cn(
                        'shrink-0 rounded px-2 py-1 text-xs transition-colors',
                        depToAdd
                          ? 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900'
                          : 'cursor-not-allowed text-zinc-300'
                      )}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            ) : viewDependencyTasks.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {viewDependencyTasks.map((dep) => (
                  <span
                    key={dep.id}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {dep.task?.title ?? 'Unknown'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">None</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
          {/* Left: delete */}
          <div>
            {canEdit && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Delete task
              </button>
            )}
            {canEdit && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Delete this task?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? 'Deleting…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Right: save/cancel */}
          <div>
            {editing && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !draftTitle.trim()}
                  className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
