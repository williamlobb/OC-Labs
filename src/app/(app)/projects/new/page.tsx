import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canCreateProject } from '@/lib/auth/permissions'
import { ProjectForm } from '@/components/projects/ProjectForm'

export default async function NewProjectPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const allowed = await canCreateProject(supabase, user.id)
  if (!allowed) redirect('/discover')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-zinc-900 dark:text-zinc-50">New project</h1>
        <p className="mt-1 text-sm text-zinc-500">Share a project with the Omnia Collective.</p>
      </div>
      <ProjectForm mode="create" />
    </div>
  )
}
