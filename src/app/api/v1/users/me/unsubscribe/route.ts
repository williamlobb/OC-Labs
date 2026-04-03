import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/v1/users/me/unsubscribe?uid=<user_id>
// One-click unsubscribe — no auth required (linked from email).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const uid = req.nextUrl.searchParams.get('uid')

  if (!uid) {
    return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ email_digest: false })
    .eq('id', uid)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Redirect to a simple confirmation page
  return NextResponse.redirect(new URL('/unsubscribed', req.url))
}
