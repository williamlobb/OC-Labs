import { type NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { upsertUser } from '@/lib/auth/upsert-user'
import { isSafeRedirect } from '@/lib/utils/is-safe-redirect'
import { syncCoWorkProfile } from '@/lib/cowork/sync'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  const destination = isSafeRedirect(next ?? '') ? next! : '/discover'

  if (!code) {
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

  return response
}
