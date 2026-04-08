import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import type { PlatformRole } from '@/types'

const VALID_PLATFORM_ROLES: PlatformRole[] = ['user', 'power_user']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: targetUserId } = await params
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

  const newRole = body.platform_role as PlatformRole | undefined
  if (!newRole || !VALID_PLATFORM_ROLES.includes(newRole)) {
    return NextResponse.json(
      { error: `platform_role must be one of: ${VALID_PLATFORM_ROLES.join(', ')}` },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ platform_role: newRole })
    .eq('id', targetUserId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
