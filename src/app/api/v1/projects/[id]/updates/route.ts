import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifyApiKey } from '@/lib/auth/api-key'
import { canEditProjectContent } from '@/lib/auth/permissions'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  // Accept session auth OR bearer API key
  let userId: string | null = null

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    userId = await verifyApiKey(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  } else {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
  }

  // Verify project exists
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('id', id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check edit permission via centralized helper
  const supabase = await createServerSupabaseClient()
  const allowed = await canEditProjectContent(supabase, userId, id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updateBody = typeof body.body === 'string' ? body.body.trim() : ''
  if (!updateBody) return NextResponse.json({ error: 'body is required' }, { status: 400 })

  const milestone = body.milestone === true

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('name')
    .eq('id', userId)
    .maybeSingle()

  const authorName =
    typeof body.author_name === 'string'
      ? body.author_name
      : (profile?.name?.trim() || 'Unknown')

  const { data: update, error } = await supabaseAdmin
    .from('updates')
    .insert({
      project_id: id,
      author_id: userId,
      author_name: authorName,
      body: updateBody,
      milestone,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(update, { status: 201 })
}
