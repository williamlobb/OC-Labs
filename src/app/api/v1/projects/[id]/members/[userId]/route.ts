import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManageMembers } from '@/lib/auth/permissions'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
): Promise<NextResponse> {
  const { id: projectId, userId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = await canManageMembers(supabase, user.id, projectId)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  if (project?.owner_id === userId) {
    return NextResponse.json({ error: 'Cannot remove the project owner' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('project_members')
    .delete()
    .eq('user_id', userId)
    .eq('project_id', projectId)

  if (error) {
    console.error('[members] delete failed:', error.message)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
