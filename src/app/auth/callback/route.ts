import { type NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { upsertUser } from '@/lib/auth/upsert-user'
import { isSafeRedirect } from '@/lib/utils/is-safe-redirect'
import { syncCoWorkProfile } from '@/lib/cowork/sync'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const destination = isSafeRedirect(next ?? '') ? next! : '/discover'

  if (!code) {
    console.error(JSON.stringify({ event: 'auth_callback_no_code' }))
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Build the redirect response first so cookies can be attached to it.
  // createServerClient in a Route Handler must write cookies onto the
  // outgoing response — not into next/headers — otherwise the session
  // cookie is lost before the redirect lands.
  const response = NextResponse.redirect(new URL(destination, request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error(JSON.stringify({ event: 'auth_callback_exchange_error', message: error.message, status: error.status, name: error.name }))
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    try {
      await upsertUser(user as User)
    } catch {
      // upsert failure does not block login — user reconciled on next request
    }
    if (user.email) {
      syncCoWorkProfile(user.id, user.email).catch((err) =>
        console.error(JSON.stringify({ event: 'cowork_sync_error', error: String(err) }))
      )
    }
  }

  // After successful auth, gate access to invited users only
  const { data: { user: authedUser } } = await supabase.auth.getUser()
  if (authedUser?.email) {
    // Check if this email has ever been invited (pending or accepted)
    const { count: inviteCount } = await supabaseAdmin
      .from('role_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('email', authedUser.email)

    if ((inviteCount ?? 0) === 0) {
      // Not invited — revoke the session we just created and redirect to error
      const errorResponse = NextResponse.redirect(new URL('/login?error=not_invited', request.url))
      // Clear any auth cookies set by exchangeCodeForSession
      response.cookies.getAll()
        .filter(c => c.name.startsWith('sb-'))
        .forEach(c => {
          errorResponse.cookies.set({ name: c.name, value: '', maxAge: 0, path: '/' })
        })
      // Also clear any pre-existing auth cookies from the request
      request.cookies.getAll()
        .filter(c => c.name.startsWith('sb-'))
        .forEach(c => {
          errorResponse.cookies.set({ name: c.name, value: '', maxAge: 0, path: '/' })
        })
      return errorResponse
    }

    // Apply any pending invitations for this user's email
    const { data: pendingInvites } = await supabaseAdmin
      .from('role_invitations')
      .select('*')
      .eq('email', authedUser.email)
      .is('accepted_at', null)

    for (const invite of (pendingInvites ?? [])) {
      if (invite.platform_role) {
        await supabaseAdmin
          .from('users')
          .update({ platform_role: invite.platform_role })
          .eq('id', authedUser.id)
      }
      if (invite.project_id && invite.project_role) {
        await supabaseAdmin
          .from('project_members')
          .upsert({
            user_id: authedUser.id,
            project_id: invite.project_id,
            role: invite.project_role
          }, { onConflict: 'user_id,project_id' })
      }
      await supabaseAdmin
        .from('role_invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id)
    }
  }

  return response
}
