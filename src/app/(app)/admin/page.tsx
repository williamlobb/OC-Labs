import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import PlatformRolesPanel from '@/components/admin/PlatformRolesPanel'
import ProjectAssignmentsPanel from '@/components/admin/ProjectAssignmentsPanel'

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const role = await getPlatformRole(supabase, user.id)
  if (!isPowerUser(role)) notFound()

  // Fetch all users with their platform roles
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, name, email, platform_role, profile_photo_url')
    .order('name')

  // Fetch all projects with owner info
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('id, title, owner_id, status')
    .order('title')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Admin</h1>
      <PlatformRolesPanel users={users ?? []} />
      <ProjectAssignmentsPanel projects={projects ?? []} />
    </div>
  )
}
