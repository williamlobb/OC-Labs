import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canEditProjectContent } from '@/lib/auth/permissions'

const VALID_STATUSES = ['todo', 'in_progress', 'done', 'blocked'] as const
type TaskStatus = (typeof VALID_STATUSES)[number]

interface DatabaseErrorLike {
  code?: string | null
  message?: string | null
  details?: string | null
}

function isPermissionDeniedError(error: DatabaseErrorLike | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42501') return true

  const details = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  return details.includes('permission denied') || details.includes('row-level security')
}

function parseDependencyIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  if (!value.every((item) => typeof item === 'string')) return null
  return Array.from(new Set(value))
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
): Promise<NextResponse> {
  const { id, taskId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canEditProjectContent(supabase, user.id, id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: existingTask, error: existingTaskError } = await supabase
    .from('tasks')
    .select('id, status, depends_on')
    .eq('id', taskId)
    .eq('project_id', id)
    .single()

  if (existingTaskError || !existingTask) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  let nextStatus = existingTask.status as TaskStatus
  if (body.status !== undefined) {
    if (!isTaskStatus(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    updates.status = body.status
    nextStatus = body.status
  }

  if (body.assignee_id !== undefined) {
    // Verify the assignee is a member of this project (or allow null to unassign)
    if (body.assignee_id !== null && typeof body.assignee_id !== 'string') {
      return NextResponse.json({ error: 'assignee_id must be a string or null' }, { status: 400 })
    }
    if (body.assignee_id !== null) {
      const { data: assigneeMembership } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', id)
        .eq('user_id', body.assignee_id)
        .maybeSingle()
      if (!assigneeMembership) {
        return NextResponse.json({ error: 'assignee_id is not a project member' }, { status: 400 })
      }
    }
    updates.assignee_id = body.assignee_id
  }

  if (body.assigned_to_agent !== undefined) {
    if (typeof body.assigned_to_agent !== 'boolean') {
      return NextResponse.json({ error: 'assigned_to_agent must be a boolean' }, { status: 400 })
    }
    updates.assigned_to_agent = body.assigned_to_agent
  }

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 })
    }
    updates.title = body.title.trim()
  }

  if (body.body !== undefined) {
    if (body.body !== null && typeof body.body !== 'string') {
      return NextResponse.json({ error: 'body must be a string or null' }, { status: 400 })
    }
    updates.body = typeof body.body === 'string' ? body.body.trim() : null
  }

  let nextDependencies = Array.isArray(existingTask.depends_on)
    ? existingTask.depends_on.filter((value): value is string => typeof value === 'string')
    : []

  if (body.depends_on !== undefined) {
    const dependencyIds = parseDependencyIds(body.depends_on)
    if (dependencyIds === null) {
      return NextResponse.json({ error: 'depends_on must be an array of task IDs' }, { status: 400 })
    }

    if (dependencyIds.includes(taskId)) {
      return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 })
    }

    if (dependencyIds.length > 0) {
      const { data: dependencyRows, error: dependencyError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', id)
        .in('id', dependencyIds)

      if (dependencyError) {
        return NextResponse.json({ error: dependencyError.message }, { status: 500 })
      }

      if ((dependencyRows ?? []).length !== dependencyIds.length) {
        return NextResponse.json({ error: 'depends_on contains unknown task IDs' }, { status: 400 })
      }
    }

    updates.depends_on = dependencyIds
    nextDependencies = dependencyIds
  }

  if (nextStatus === 'done' && nextDependencies.length > 0) {
    const { data: dependencyStatuses, error: dependencyStatusError } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('project_id', id)
      .in('id', nextDependencies)

    if (dependencyStatusError) {
      return NextResponse.json({ error: dependencyStatusError.message }, { status: 500 })
    }

    const dependenciesById = new Map((dependencyStatuses ?? []).map((task) => [task.id, task.status]))
    const unresolvedCount = nextDependencies.filter((depId) => dependenciesById.get(depId) !== 'done').length
    if (unresolvedCount > 0) {
      return NextResponse.json(
        { error: 'Cannot mark task done while dependencies are not done' },
        { status: 400 }
      )
    }
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('project_id', id)
    .select()
    .single()

  if (error) {
    if (isPermissionDeniedError(error)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(task)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
): Promise<NextResponse> {
  const { id, taskId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canEditProjectContent(supabase, user.id, id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('project_id', id)

  if (error) {
    if (isPermissionDeniedError(error)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
