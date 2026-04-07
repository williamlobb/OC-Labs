import type { Task } from '@/types'

const MS_PER_HOUR = 60 * 60 * 1000
const DRAFT_PREVIEW_LIMIT = 4

export const BLOCKED_TASK_PROMPT_AFTER_HOURS = 48

export interface OverdueBlockedTask {
  id: string
  title: string
  blockedForHours: number
}

function calculateBlockedHours(updatedAt: string, nowMs: number): number | null {
  const updatedAtMs = Date.parse(updatedAt)
  if (Number.isNaN(updatedAtMs)) return null
  return Math.max(0, (nowMs - updatedAtMs) / MS_PER_HOUR)
}

export function getOverdueBlockedTasks(tasks: Task[], now: Date = new Date()): OverdueBlockedTask[] {
  const nowMs = now.getTime()

  return tasks
    .filter((task) => task.status === 'blocked')
    .map((task) => {
      const blockedForHours = calculateBlockedHours(task.updated_at, nowMs)
      if (blockedForHours === null) return null

      return {
        id: task.id,
        title: task.title,
        blockedForHours,
      }
    })
    .filter((task): task is OverdueBlockedTask => {
      return !!task && task.blockedForHours >= BLOCKED_TASK_PROMPT_AFTER_HOURS
    })
    .sort((a, b) => b.blockedForHours - a.blockedForHours)
}

export function formatBlockedDuration(hours: number): string {
  if (hours >= 24) {
    return `${Math.floor(hours / 24)}d`
  }

  if (hours >= 1) {
    return `${Math.floor(hours)}h`
  }

  return '<1h'
}

export function buildBlockedPromptDraft(overdueBlockedTasks: OverdueBlockedTask[]): string {
  if (overdueBlockedTasks.length === 0) return ''

  if (overdueBlockedTasks.length === 1) {
    const task = overdueBlockedTasks[0]
    return `Task "${task.title}" has been blocked for ${formatBlockedDuration(task.blockedForHours)}.\n\nCurrent blocker:\n- \n\nWhat we need to unblock next:\n- `
  }

  const listedTasks = overdueBlockedTasks
    .slice(0, DRAFT_PREVIEW_LIMIT)
    .map((task) => `- ${task.title}`)
    .join('\n')

  const remainingCount = overdueBlockedTasks.length - DRAFT_PREVIEW_LIMIT
  const remainingLine =
    remainingCount > 0
      ? `\n- ...and ${remainingCount} more blocked task${remainingCount === 1 ? '' : 's'}`
      : ''

  return `${overdueBlockedTasks.length} tasks have been blocked for more than ${BLOCKED_TASK_PROMPT_AFTER_HOURS} hours.\n\nCurrent blockers:\n${listedTasks}${remainingLine}\n\nWhat we need to unblock next:\n- `
}
