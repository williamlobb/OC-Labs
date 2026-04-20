import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canCreateProject, getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import { ProjectForm } from '@/components/projects/ProjectForm'

export default async function NewProjectPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [allowed, platformRole] = await Promise.all([
    canCreateProject(supabase, user.id),
    getPlatformRole(supabase, user.id),
  ])
  if (!allowed) redirect('/discover')
  const powerUser = isPowerUser(platformRole)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {powerUser ? 'New project' : 'Submit an idea'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {powerUser
            ? 'Share a project with the Omnia Collective.'
            : 'Your idea will be reviewed by a power user before it appears on Discover.'}
        </p>
      </div>
      <ProjectForm mode="create" isPowerUser={powerUser} />
    </div>
  )
}
