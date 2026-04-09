import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
): Promise<NextResponse> {
  const { id, updateId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existingUpdate, error: existingUpdateError } = await supabase
    .from('updates')
    .select('id, author_id')
    .eq('id', updateId)
    .eq('project_id', id)
    .single()

  if (existingUpdateError || !existingUpdate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (existingUpdate.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (body.body !== undefined) {
    if (typeof body.body !== 'string' || !body.body.trim()) {
      return NextResponse.json({ error: 'body must be a non-empty string' }, { status: 400 })
    }

    updates.body = body.body.trim()
  }

  if (body.milestone !== undefined) {
    if (typeof body.milestone !== 'boolean') {
      return NextResponse.json({ error: 'milestone must be a boolean' }, { status: 400 })
    }

    updates.milestone = body.milestone
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'At least one of body or milestone is required' },
      { status: 400 }
    )
  }

  const { data: update, error } = await supabase
    .from('updates')
    .update(updates)
    .eq('id', updateId)
    .eq('project_id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(update)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
): Promise<NextResponse> {
  const { id, updateId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existingUpdate, error: existingUpdateError } = await supabase
    .from('updates')
    .select('id, author_id')
    .eq('id', updateId)
    .eq('project_id', id)
    .single()

  if (existingUpdateError || !existingUpdate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (existingUpdate.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('updates')
    .delete()
    .eq('id', updateId)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
