import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import { sendRoleInviteEmail } from '@/lib/email/invite'
import { normalizeEmail } from '@/lib/utils/email'
import type { PlatformRole, MemberRole } from '@/types'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://oclabs.space'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const platformRole = await getPlatformRole(supabase, user.id)
  if (!isPowerUser(platformRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = normalizeEmail(typeof body.email === 'string' ? body.email : '')
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const VALID_PLATFORM_ROLES: PlatformRole[] = ['user', 'power_user']
  const VALID_MEMBER_ROLES: MemberRole[] = ['owner', 'tech_lead', 'contributor', 'observer', 'interested']

  const rawPlatformRole = body.platform_role
  if (rawPlatformRole !== undefined && !VALID_PLATFORM_ROLES.includes(rawPlatformRole as PlatformRole)) {
    return NextResponse.json({ error: 'Invalid platform_role' }, { status: 400 })
  }
  const requestedPlatformRole = rawPlatformRole as PlatformRole | undefined

  const projectId = typeof body.project_id === 'string' ? body.project_id : undefined

  const rawProjectRole = body.project_role
  if (rawProjectRole !== undefined && !VALID_MEMBER_ROLES.includes(rawProjectRole as MemberRole)) {
    return NextResponse.json({ error: 'Invalid project_role' }, { status: 400 })
  }
  const projectRole = rawProjectRole as MemberRole | undefined

  const hasPlatformRole = !!requestedPlatformRole
  const hasProjectRole = !!(projectId && projectRole)

  if (!hasPlatformRole && !hasProjectRole) {
    return NextResponse.json(
      { error: 'At least one of platform_role or (project_id + project_role) is required' },
      { status: 400 }
    )
  }

  if (projectId && !projectRole) {
    return NextResponse.json(
      { error: 'project_role is required when project_id is provided' },
      { status: 400 }
    )
  }

  const token = randomBytes(32).toString('hex')

  const { data: invitation, error: insertError } = await supabaseAdmin
    .from('role_invitations')
    .insert({
      email,
      platform_role: requestedPlatformRole ?? null,
      project_id: projectId ?? null,
      project_role: projectRole ?? null,
      invited_by: user.id,
      token,
    })
    .select()
    .single()

  if (insertError || !invitation) {
    console.error('[invitations] insert failed:', insertError?.message)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  const { data: inviterProfile } = await supabaseAdmin
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()

  const inviterName = inviterProfile?.name ?? user.email ?? 'A team member'
  const acceptUrl = `${SITE_URL}/api/v1/invitations/${token}/accept`

  const roleForEmail = requestedPlatformRole ?? projectRole ?? null

  try {
    await sendRoleInviteEmail(email, roleForEmail, inviterName, acceptUrl)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('Failed to send invite email:', detail)
    return NextResponse.json(
      { error: `Invitation created but email delivery failed: ${detail}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, id: invitation.id }, { status: 201 })
}
