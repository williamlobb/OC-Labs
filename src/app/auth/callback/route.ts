import { type NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { upsertUser } from '@/lib/auth/upsert-user'
import { isSafeRedirect } from '@/lib/utils/is-safe-redirect'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  const destination = isSafeRedirect(next ?? '') ? next! : '/discover'

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    try {
      await upsertUser(user as User)
    } catch {
      // Profile setup failure should not block auth — user can be reconciled later
    }
  }

  return NextResponse.redirect(new URL(destination, request.url))
}
