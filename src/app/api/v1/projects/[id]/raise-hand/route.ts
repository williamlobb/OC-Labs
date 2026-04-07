import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { dmOwnerRaisedHand } from '@/lib/notifications/slack'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch project + owner info
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id, title, users!projects_owner_id_fkey(name)')
    .eq('id', id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (project.owner_id === user.id) {
    return NextResponse.json({ error: 'Cannot raise hand on your own project' }, { status: 403 })
  }

  // Check existing membership
  const { data: existing } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  let hasJoined: boolean
  let membershipRole: 'owner' | 'contributor' | 'observer' | 'interested' | null

  if (existing && existing.role !== 'interested') {
    // Already approved on the team; this endpoint should not remove membership.
    return NextResponse.json({ hasJoined: true, membershipRole: existing.role })
  }

  if (existing && existing.role === 'interested') {
    // Remove interest
    await supabase
      .from('project_members')
      .delete()
      .eq('project_id', id)
      .eq('user_id', user.id)
    hasJoined = false
    membershipRole = null
  } else {
    // Add interest
    await supabase.from('project_members').insert({
      project_id: id,
      user_id: user.id,
      role: 'interested',
    })
    hasJoined = true
    membershipRole = 'interested'

    // Notify owner — fire and forget
    const { data: raisedByUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single()

    type OwnerRow = { name?: string } | { name?: string }[] | null
    const ownerRecord = project.users as OwnerRow
    const ownerName = Array.isArray(ownerRecord)
      ? (ownerRecord[0]?.name ?? 'Unknown')
      : (ownerRecord?.name ?? 'Unknown')

    dmOwnerRaisedHand(
      ownerName,
      raisedByUser?.name ?? user.email ?? 'Someone',
      project.title
    ).catch((err) => console.error('Slack notify failed:', err))
  }

  return NextResponse.json({ hasJoined, membershipRole })
}
