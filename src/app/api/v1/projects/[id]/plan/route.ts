import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { decomposeProject } from '@/lib/ai/decompose'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['owner', 'contributor'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [{ data: project }, { data: contextBlocks }] = await Promise.all([
    supabase.from('projects').select('title, summary').eq('id', id).single(),
    supabase
      .from('context_blocks')
      .select('title, body, block_type')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tasks = await decomposeProject(
    project.title,
    project.summary ?? '',
    contextBlocks ?? []
  )

  if (tasks.length === 0) {
    return NextResponse.json({ tasks: [] })
  }

  const rows = tasks.map((t) => ({
    project_id: id,
    title: t.title,
    body: t.body,
    status: 'todo',
    assigned_to_agent: t.assigned_to_agent,
    created_by: user.id,
  }))

  const { data: inserted, error } = await supabase
    .from('tasks')
    .insert(rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tasks: inserted })
}
