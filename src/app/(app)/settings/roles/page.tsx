import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import PlatformRolesPanel from '@/components/admin/PlatformRolesPanel'

export default async function RolesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const role = await getPlatformRole(supabase, user.id)
  if (!isPowerUser(role)) notFound()

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, name, email, platform_role, profile_photo_url')
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Platform Roles</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage platform-wide roles. Power users can access settings and all projects.
        </p>
      </div>
      <PlatformRolesPanel users={users ?? []} />
    </div>
  )
}
