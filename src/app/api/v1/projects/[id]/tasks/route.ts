import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canEditProjectContent } from '@/lib/auth/permissions'

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
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  if (!value.every((item) => typeof item === 'string')) return null
  return Array.from(new Set(value))
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(tasks ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canEditProjectContent(supabase, user.id, id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const taskBody = body.body
  const assignedToAgent = body.assigned_to_agent ?? false
  const dependencyIds = parseDependencyIds(body.depends_on)

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  if (dependencyIds === null) {
    return NextResponse.json({ error: 'depends_on must be an array of task IDs' }, { status: 400 })
  }

  if (typeof assignedToAgent !== 'boolean') {
    return NextResponse.json({ error: 'assigned_to_agent must be a boolean' }, { status: 400 })
  }

  if (taskBody !== undefined && taskBody !== null && typeof taskBody !== 'string') {
    return NextResponse.json({ error: 'body must be a string or null' }, { status: 400 })
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

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      project_id: id,
      title,
      body: typeof taskBody === 'string' ? taskBody.trim() : null,
      assigned_to_agent: assignedToAgent,
      depends_on: dependencyIds,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (isPermissionDeniedError(error)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(task, { status: 201 })
}
