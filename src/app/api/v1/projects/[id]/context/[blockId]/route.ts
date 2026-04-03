import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
): Promise<NextResponse> {
  const { id, blockId } = await params
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

  const body = await req.json()
  const { title, body: blockBody, block_type } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title?.trim()) updates.title = title.trim()
  if (blockBody?.trim()) updates.body = blockBody.trim()
  if (block_type) updates.block_type = block_type

  // Reject requests that carry no meaningful changes
  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Increment version on edit
  const { data: existing } = await supabase
    .from('context_blocks')
    .select('version')
    .eq('id', blockId)
    .eq('project_id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  updates.version = (existing.version ?? 1) + 1

  const { data: block, error } = await supabase
    .from('context_blocks')
    .update(updates)
    .eq('id', blockId)
    .eq('project_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(block)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
): Promise<NextResponse> {
  const { id, blockId } = await params
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

  const { error } = await supabase
    .from('context_blocks')
    .delete()
    .eq('id', blockId)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
