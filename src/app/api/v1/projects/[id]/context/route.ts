import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: project }, { data: members }, { data: blocks }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, summary, status, skills_needed')
      .eq('id', id)
      .single(),
    supabase
      .from('project_members')
      .select('role, users(name)')
      .eq('project_id', id),
    supabase
      .from('context_blocks')
      .select('id, title, body, block_type, version, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type MemberRow = { role: string; users: { name: string } | { name: string }[] | null }
  const team = (members ?? []).map((m: MemberRow) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users
    return { name: u?.name ?? 'Unknown', role: m.role }
  })

  return NextResponse.json({
    project: {
      id: project.id,
      title: project.title,
      summary: project.summary,
      status: project.status,
      skills_needed: project.skills_needed,
    },
    team,
    blocks: blocks ?? [],
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only owner/contributor can write
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['owner', 'contributor'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { title, body: blockBody, block_type = 'general' } = body

  if (!title?.trim() || !blockBody?.trim()) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  const { data: block, error } = await supabase
    .from('context_blocks')
    .insert({
      project_id: id,
      author_id: user.id,
      title: title.trim(),
      body: blockBody.trim(),
      block_type,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(block, { status: 201 })
}
