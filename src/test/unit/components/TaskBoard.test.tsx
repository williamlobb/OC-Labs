import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskBoard } from '@/components/plan/TaskBoard'
import type { Task } from '@/types'

function makeTask(overrides: Partial<Task>): Task {
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

describe('TaskBoard blocked prompt', () => {
  const teamMembers = [{ user_id: 'user-1', name: 'Owner' }]

  it('shows owner prompt when blocked tasks are stale', () => {
    render(
      <TaskBoard
        projectId="proj-1"
        initialTasks={[
          makeTask({
            id: 'blocked-task',
            status: 'blocked',
            updated_at: '2026-01-01T00:00:00.000Z',
          }),
        ]}
        teamMembers={teamMembers}
        canEdit
        viewerRole="owner"
      />
    )

    expect(
      screen.getByText(/task has been blocked for more than 48 hours/i)
    ).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /post update/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('/projects/proj-1?compose=1&draft='))
  })

  it('does not show owner prompt for non-owner viewers', () => {
    render(
      <TaskBoard
        projectId="proj-1"
        initialTasks={[
          makeTask({
            id: 'blocked-task',
            status: 'blocked',
            updated_at: '2026-01-01T00:00:00.000Z',
          }),
        ]}
        teamMembers={teamMembers}
        canEdit
        viewerRole="contributor"
      />
    )

    expect(screen.queryByRole('link', { name: /post update/i })).not.toBeInTheDocument()
  })
})
