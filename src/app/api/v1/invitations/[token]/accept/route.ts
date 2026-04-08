import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', `/api/v1/invitations/${token}/accept`)
    return NextResponse.redirect(loginUrl)
  }

  const { data: invitation } = await supabaseAdmin
    .from('role_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!invitation || invitation.accepted_at !== null) {
    return NextResponse.redirect(new URL('/discover?error=invalid_invitation', request.url))
  }

  if (invitation.email !== user.email) {
    return NextResponse.redirect(new URL('/discover?error=invitation_email_mismatch', request.url))
  }

  if (invitation.platform_role) {
    await supabaseAdmin
      .from('users')
      .update({ platform_role: invitation.platform_role })
      .eq('id', user.id)
  }

  if (invitation.project_id && invitation.project_role) {
    await supabaseAdmin
      .from('project_members')
      .upsert(
        {
          user_id: user.id,
          project_id: invitation.project_id,
          role: invitation.project_role,
        },
        { onConflict: 'user_id,project_id' }
      )
  }

  await supabaseAdmin
    .from('role_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  if (invitation.project_id) {
    return NextResponse.redirect(
      new URL(`/projects/${invitation.project_id}?success=role_applied`, request.url)
    )
  }

  return NextResponse.redirect(new URL('/discover?success=role_applied', request.url))
}
