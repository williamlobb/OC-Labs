import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCard } from '@/components/plan/TaskCard'
import type { Task } from '@/types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    project_id: 'proj-1',
    title: 'Investigate flaky deploy',
    body: '',
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

function renderTaskCard(canEdit: boolean, onInspect = vi.fn()) {
  const task = makeTask()
  render(
    <TaskCard
      task={task}
      allTasks={[task]}
      teamMembers={[{ user_id: 'user-1', name: 'Owner' }]}
      canEdit={canEdit}
      unresolvedDependencyCount={0}
      onStatusChange={vi.fn()}
      onAssign={vi.fn()}
      onAgentToggle={vi.fn()}
      onDependenciesChange={vi.fn()}
      onInspect={onInspect}
    />
  )
  return { onInspect }
}

describe('TaskCard discoverability actions', () => {
  it('shows Open details for all viewers', () => {
    renderTaskCard(false)
    expect(screen.getByRole('button', { name: 'Open details' })).toBeInTheDocument()
  })

  it('shows Edit shortcut for editors and routes to edit mode', async () => {
    const user = userEvent.setup()
    const onInspect = vi.fn()
    renderTaskCard(true, onInspect)

    await user.click(screen.getByRole('button', { name: 'Open details' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(onInspect).toHaveBeenNthCalledWith(1, 'task-1')
    expect(onInspect).toHaveBeenNthCalledWith(2, 'task-1', 'edit')
  })

  it('hides Edit shortcut for non-edit viewers', () => {
    renderTaskCard(false)
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })
})
