import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Fields the user is allowed to update directly.
// CoWork-sourced fields (name, title, brand, profile_photo_url) are intentionally excluded.
const ALLOWED_FIELDS = ['linkedin_url', 'github_username'] as const

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Build update object from allowed fields only
  const updates: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      const val = body[field]
      if (val === null || typeof val === 'string') {
        updates[field] = val
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Handle skills separately — replace all user skills
  if ('skills' in body && Array.isArray(body.skills)) {
    const skills = body.skills.filter((s): s is string => typeof s === 'string')

    // Delete existing skills then insert new ones
    await supabase.from('user_skills').delete().eq('user_id', user.id)

    if (skills.length > 0) {
      await supabase.from('user_skills').insert(
        skills.map((skill) => ({ user_id: user.id, skill, source: 'manual' }))
      )
    }
  }

  return NextResponse.json({ ok: true })
}
