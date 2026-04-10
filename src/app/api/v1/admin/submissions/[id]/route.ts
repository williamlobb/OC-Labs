import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import { notifyNewProject } from '@/lib/notifications/slack-events'
import { createEpic } from '@/lib/jira/client'

type SubmissionAction = 'approve' | 'reject'

function parseAction(value: unknown): SubmissionAction | null {
  if (value === 'approve' || value === 'reject') return value
  return null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = await getPlatformRole(supabase, user.id)
  if (!isPowerUser(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = parseAction(body.action)
  if (!action) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('projects')
    .select('id, title, submission_status, jira_epic_key, users!projects_owner_id_fkey(name, email)')
    .eq('id', id)
    .single()

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const nextStatus = action === 'approve' ? 'approved' : 'rejected'
  if (existing.submission_status === nextStatus) {
    return NextResponse.json({ id: existing.id, submission_status: existing.submission_status })
  }

  const { data: project, error: updateError } = await supabaseAdmin
    .from('projects')
    .update({ submission_status: nextStatus })
    .eq('id', id)
    .select('id, title, submission_status')
    .single()

  if (updateError || !project) {
    return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 })
  }

  if (nextStatus === 'approved') {
    type OwnerRow = { name?: string | null; email?: string | null } | { name?: string | null; email?: string | null }[] | null
    const ownerRecord = existing.users as OwnerRow
    const owner = Array.isArray(ownerRecord) ? ownerRecord[0] : ownerRecord
    const ownerDisplayName = owner?.name ?? owner?.email ?? 'Unknown'

    notifyNewProject(existing.id, existing.title, ownerDisplayName).catch((err) =>
      console.error('Slack notify failed:', err)
    )

    if (
      !existing.jira_epic_key &&
      process.env.JIRA_BASE_URL &&
      process.env.JIRA_EMAIL &&
      process.env.JIRA_API_TOKEN &&
      process.env.JIRA_PROJECT_KEY
    ) {
      createEpic(existing.title)
        .then((epicKey) =>
          supabaseAdmin
            .from('projects')
            .update({ jira_epic_key: epicKey })
            .eq('id', existing.id)
        )
        .catch((err) => console.error('Jira create epic failed:', err))
    }
  }

  return NextResponse.json(project)
}
