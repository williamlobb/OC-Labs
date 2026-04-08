import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManageMembers } from '@/lib/auth/permissions'
import type { MemberRole } from '@/types'

const VALID_MEMBER_ROLES: MemberRole[] = ['owner', 'contributor', 'interested', 'observer', 'tech_lead']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = await canManageMembers(supabase, user.id, projectId)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const targetUserId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!targetUserId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  const role = body.role as MemberRole | undefined
  if (!role || !VALID_MEMBER_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `role must be one of: ${VALID_MEMBER_ROLES.join(', ')}` },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('project_members')
    .upsert(
      {
        user_id: targetUserId,
        project_id: projectId,
        role,
      },
      { onConflict: 'user_id,project_id' }
    )

  if (error) {
    console.error('[members] upsert failed:', error.message)
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
