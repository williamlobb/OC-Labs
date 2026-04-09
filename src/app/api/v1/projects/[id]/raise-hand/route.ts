import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { dmOwnerRaisedHand } from '@/lib/notifications/slack'
import type { MemberRole } from '@/types'

interface ProjectOwnerInfo {
  owner_id: string
  title: string
  users: { name?: string } | { name?: string }[] | null
}

async function getProjectOwnerInfo(
  projectId: string,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<ProjectOwnerInfo | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id, title, users!projects_owner_id_fkey(name)')
    .eq('id', projectId)
    .single()

  return project as ProjectOwnerInfo | null
}

function resolveOwnerName(project: ProjectOwnerInfo): string {
  const ownerRecord = project.users
  if (Array.isArray(ownerRecord)) {
    return ownerRecord[0]?.name ?? 'Unknown'
  }

  return ownerRecord?.name ?? 'Unknown'
}

async function maybeNotifyOwnerFirstTime(
  projectId: string,
  userId: string,
  projectTitle: string,
  ownerName: string,
  raisedByName: string
): Promise<void> {
  const { error: markerError } = await supabaseAdmin
    .from('project_hand_raise_notifications')
    .insert({
      project_id: projectId,
      user_id: userId,
      notified_at: new Date().toISOString(),
    })

  if (markerError) {
    if (markerError.code === '23505') {
      return
    }

    console.error('[raise-hand] failed to persist notification marker:', markerError.message)
    return
  }

  dmOwnerRaisedHand(ownerName, raisedByName, projectTitle).catch((err) =>
    console.error('Slack notify failed:', err)
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = await getProjectOwnerInfo(id, supabase)
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (project.owner_id === user.id) {
    return NextResponse.json({ error: 'Cannot raise hand on your own project' }, { status: 403 })
  }

  const { data: existingMembership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const existingRole = (existingMembership?.role ?? null) as MemberRole | null
  if (existingRole && existingRole !== 'interested') {
    return NextResponse.json({ membershipRole: existingRole, hasJoined: true, alreadyMember: true })
  }

  if (existingRole === 'interested') {
    return NextResponse.json({ membershipRole: 'interested', hasJoined: true, alreadyRequested: true })
  }

  const { error: insertError } = await supabase.from('project_members').insert({
    project_id: id,
    user_id: user.id,
    role: 'interested',
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ membershipRole: 'interested', hasJoined: true, alreadyRequested: true })
    }

    return NextResponse.json({ error: insertError.message ?? 'Failed to raise hand' }, { status: 500 })
  }

  const { data: raisedByUser } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()

  void maybeNotifyOwnerFirstTime(
    id,
    user.id,
    project.title,
    resolveOwnerName(project),
    raisedByUser?.name ?? user.email ?? 'Someone'
  )

  return NextResponse.json({ membershipRole: 'interested', hasJoined: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existingMembership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const existingRole = (existingMembership?.role ?? null) as MemberRole | null

  if (existingRole === null) {
    return NextResponse.json({ membershipRole: null, hasJoined: false, alreadyWithdrawn: true })
  }

  if (existingRole !== 'interested') {
    return NextResponse.json(
      { error: 'Cannot withdraw an approved membership', membershipRole: existingRole },
      { status: 409 }
    )
  }

  const { error: deleteError } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', id)
    .eq('user_id', user.id)

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message ?? 'Failed to withdraw hand raise' },
      { status: 500 }
    )
  }

  return NextResponse.json({ membershipRole: null, hasJoined: false })
}
