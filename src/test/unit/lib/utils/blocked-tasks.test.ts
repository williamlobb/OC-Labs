import { describe, expect, it } from 'vitest'
import {
  BLOCKED_TASK_PROMPT_AFTER_HOURS,
  buildBlockedPromptDraft,
  formatBlockedDuration,
  getOverdueBlockedTasks,
} from '@/lib/utils/blocked-tasks'
import type { Task } from '@/types'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    project_id: 'proj-1',
    title: 'Default title',
    body: 'Task body',
    status: 'todo',
    assignee_id: undefined,
    assigned_to_agent: false,
    depends_on: [],
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('blocked-tasks utils', () => {
  it('returns only blocked tasks that are older than the prompt threshold', () => {
    const now = new Date('2026-04-07T00:00:00.000Z')
    const tasks = [
      makeTask({
        id: 'task-overdue',
        status: 'blocked',
        updated_at: '2026-04-04T00:00:00.000Z',
      }),
      makeTask({
        id: 'task-recent',
        status: 'blocked',
        updated_at: '2026-04-06T12:00:00.000Z',
      }),
      makeTask({
        id: 'task-done',
        status: 'done',
        updated_at: '2026-04-01T00:00:00.000Z',
      }),
    ]

    const overdue = getOverdueBlockedTasks(tasks, now)

    expect(overdue).toHaveLength(1)
    expect(overdue[0].id).toBe('task-overdue')
    expect(overdue[0].blockedForHours).toBeGreaterThanOrEqual(BLOCKED_TASK_PROMPT_AFTER_HOURS)
  })

  it('formats blocked duration in days and hours', () => {
    expect(formatBlockedDuration(54)).toBe('2d')
    expect(formatBlockedDuration(5)).toBe('5h')
  })

  it('builds a grouped draft for multiple blocked tasks', () => {
    const draft = buildBlockedPromptDraft([
      { id: '1', title: 'Auth callback flaky', blockedForHours: 120 },
      { id: '2', title: 'Missing Supabase trigger', blockedForHours: 72 },
    ])

    expect(draft).toContain('tasks have been blocked for more than')
    expect(draft).toContain('- Auth callback flaky')
    expect(draft).toContain('- Missing Supabase trigger')
  })
})
