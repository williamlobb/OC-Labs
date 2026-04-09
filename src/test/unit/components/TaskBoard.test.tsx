import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('TaskBoard Jira sync flow', () => {
  const teamMembers = [{ user_id: 'user-1', name: 'Owner' }]

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows confirmation modal when sync requires unassigned-task confirmation', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'UNASSIGNED_TASKS_CONFIRMATION_REQUIRED',
          message: 'Some tasks are still unassigned.',
          unassignedTaskCount: 2,
          unassignedTaskPreview: ['Draft launch notes', 'Finalize copy'],
        }),
        { status: 409 }
      )
    )

    const user = userEvent.setup()
    render(
      <TaskBoard
        projectId="proj-1"
        initialTasks={[makeTask({ id: 'task-1' })]}
        teamMembers={teamMembers}
        canEdit
        viewerRole="owner"
      />
    )

    await user.click(screen.getByRole('button', { name: /sync to jira/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/some tasks are still unassigned/i)).toBeInTheDocument()
    expect(screen.getByText('Draft launch notes')).toBeInTheDocument()
  })

  it('retries sync with allowUnassigned=true after confirmation', async () => {
    const fetchMock = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'UNASSIGNED_TASKS_CONFIRMATION_REQUIRED',
            message: 'Some tasks are still unassigned.',
            unassignedTaskCount: 1,
            unassignedTaskPreview: ['Draft launch notes'],
          }),
          { status: 409 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            created: 1,
            skipped: 0,
            failed: 0,
            message: 'Jira sync complete: 1 created and 0 skipped.',
            warning: 'Included 1 unassigned task because you confirmed sync anyway.',
          }),
          { status: 200 }
        )
      )

    const user = userEvent.setup()
    render(
      <TaskBoard
        projectId="proj-1"
        initialTasks={[makeTask({ id: 'task-1' })]}
        teamMembers={teamMembers}
        canEdit
        viewerRole="owner"
      />
    )

    await user.click(screen.getByRole('button', { name: /sync to jira/i }))
    await user.click(await screen.findByRole('button', { name: /sync anyway/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const secondCall = fetchMock.mock.calls[1]
    const init = secondCall?.[1] as RequestInit | undefined
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ allowUnassigned: true }))
  })

  it('keeps sync feedback visible until dismissed manually', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          created: 1,
          skipped: 0,
          failed: 0,
          message: 'Jira sync complete: 1 created and 0 skipped.',
        }),
        { status: 200 }
      )
    )

    const user = userEvent.setup()
    render(
      <TaskBoard
        projectId="proj-1"
        initialTasks={[makeTask({ id: 'task-1' })]}
        teamMembers={teamMembers}
        canEdit
        viewerRole="owner"
      />
    )

    await user.click(screen.getByRole('button', { name: /sync to jira/i }))

    expect(await screen.findByText(/jira sync completed/i)).toBeInTheDocument()
    expect(screen.getByText(/1 created and 0 skipped/i)).toBeInTheDocument()

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByText(/jira sync completed/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /dismiss jira sync feedback/i }))
    expect(screen.queryByText(/jira sync completed/i)).not.toBeInTheDocument()
  })
})
