import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import ProjectAssignmentsPanel from '@/components/admin/ProjectAssignmentsPanel'

export default async function ProjectAssignmentsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const role = await getPlatformRole(supabase, user.id)
  if (!isPowerUser(role)) notFound()

  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('id, title, owner_id, status')
    .order('title')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Project Assignments</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Invite members to projects and manage platform invitations.
        </p>
      </div>
      <ProjectAssignmentsPanel projects={projects ?? []} />
    </div>
  )
}
