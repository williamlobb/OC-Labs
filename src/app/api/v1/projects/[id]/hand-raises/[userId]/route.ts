import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canReviewHandRaises } from '@/lib/auth/permissions'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
): Promise<NextResponse> {
  const { id, userId } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = await canReviewHandRaises(supabase, user.id, id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: requestedMember } = await supabaseAdmin
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!requestedMember) {
    return NextResponse.json({ error: 'Hand raise request not found' }, { status: 404 })
  }

  if (requestedMember.role !== 'interested') {
    return NextResponse.json(
      { error: 'Member is already approved', membershipRole: requestedMember.role },
      { status: 409 }
    )
  }

  const { error: deleteError } = await supabaseAdmin
    .from('project_members')
    .delete()
    .eq('project_id', id)
    .eq('user_id', userId)

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message ?? 'Failed to deny hand raise request' },
      { status: 500 }
    )
  }

  return NextResponse.json({ deniedUserId: userId, membershipRole: null })
}
