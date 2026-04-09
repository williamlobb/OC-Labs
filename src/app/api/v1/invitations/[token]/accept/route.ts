import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { emailsEqual } from '@/lib/utils/email'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const signupUrl = new URL('/signup', request.url)
    signupUrl.searchParams.set('redirectTo', `/api/v1/invitations/${token}/accept`)
    return NextResponse.redirect(signupUrl)
  }

  const { data: invitation } = await supabaseAdmin
    .from('role_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!invitation) {
    return NextResponse.redirect(new URL('/discover?error=invalid_invitation', request.url))
  }

  // Idempotent path: the auth callback pre-applies roles on email-confirmation
  // and GitHub OAuth flows, marking accepted_at before redirecting here.
  // If this user's email matches, the invite was legitimately accepted — send
  // them to the success destination rather than surfacing an error.
  if (invitation.accepted_at !== null) {
    if (emailsEqual(invitation.email, user.email)) {
      if (invitation.project_id) {
        return NextResponse.redirect(
          new URL(`/projects/${invitation.project_id}?success=role_applied`, request.url)
        )
      }
      return NextResponse.redirect(new URL('/discover?success=role_applied', request.url))
    }
    return NextResponse.redirect(new URL('/discover?error=invalid_invitation', request.url))
  }

  if (!emailsEqual(invitation.email, user.email)) {
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
