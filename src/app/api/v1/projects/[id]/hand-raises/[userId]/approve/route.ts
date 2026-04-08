import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canManageMembers } from '@/lib/auth/permissions'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
): Promise<NextResponse> {
  const { id, userId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = await canManageMembers(supabase, user.id, id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: requestedMember } = await supabase
    .from('project_members')
    .select('role, users(name, profile_photo_url)')
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

  const { data: updatedMember, error: updateError } = await supabase
    .from('project_members')
    .update({ role: 'contributor' })
    .eq('project_id', id)
    .eq('user_id', userId)
    .select('role, users(name, profile_photo_url)')
    .single()

  if (updateError || !updatedMember) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Failed to approve member' },
      { status: 500 }
    )
  }

  type UserRow = { name?: string; profile_photo_url?: string | null } | { name?: string; profile_photo_url?: string | null }[] | null
  const userRecord = updatedMember.users as UserRow
  const profile = Array.isArray(userRecord) ? userRecord[0] : userRecord

  return NextResponse.json({
    approvedUserId: userId,
    membershipRole: updatedMember.role,
    member: {
      user_id: userId,
      name: profile?.name ?? 'Unknown',
      role: updatedMember.role,
      profile_photo_url: profile?.profile_photo_url ?? null,
    },
  })
}
