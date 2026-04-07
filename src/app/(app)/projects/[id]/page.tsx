import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TeamList } from '@/components/projects/TeamList'
import { UpdatesFeed } from '@/components/projects/UpdatesFeed'
import { RepoPreview } from '@/components/projects/RepoPreview'
import { PostUpdateForm } from '@/components/projects/PostUpdateForm'
import type { MemberRole, ProjectUpdate } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ compose?: string; draft?: string }>
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { compose, draft } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const [{ data: members }, { data: updates }, { data: membership }] = await Promise.all([
    supabase
      .from('project_members')
      .select('user_id, role, users(name, profile_photo_url)')
      .eq('project_id', id)
      .in('role', ['owner', 'contributor', 'observer']),
    supabase
      .from('updates')
      .select('*')
      .eq('project_id', id)
      .order('posted_at', { ascending: false }),
    supabase
      .from('project_members')
      .select('role')
      .eq('project_id', id)
      .eq('user_id', user?.id ?? '')
      .maybeSingle(),
  ])

  const canPostUpdate = !!membership && ['owner', 'contributor'].includes(membership.role)
  const draftBody = typeof draft === 'string' ? draft.slice(0, 4000) : ''
  const shouldAutoFocusCompose = compose === '1'

  type MemberRow = {
    user_id: string
    role: MemberRole
    users: { name: string; profile_photo_url: string | null }[] | { name: string; profile_photo_url: string | null } | null
  }

  const teamMembers = (members ?? []).map((m: MemberRow) => {
    const userRecord = Array.isArray(m.users) ? m.users[0] : m.users
    return {
      user_id: m.user_id,
      name: userRecord?.name ?? 'Unknown',
      role: m.role,
      profile_photo_url: userRecord?.profile_photo_url ?? null,
    }
  })

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-8">
        {/* GitHub repos */}
        {project.github_repos?.length > 0 && (
          <section>
            <h2 className="font-heading mb-3 text-base font-bold text-zinc-900 dark:text-zinc-100">
              Repositories
            </h2>
            <div className="space-y-3">
              {project.github_repos.map((url: string) => (
                <RepoPreview key={url} repoUrl={url} />
              ))}
            </div>
          </section>
        )}

        {/* Updates feed */}
        <section>
          <h2 className="font-heading mb-3 text-base font-bold text-zinc-900 dark:text-zinc-100">
            Updates
          </h2>
          {canPostUpdate && (
            <PostUpdateForm
              projectId={id}
              initialBody={draftBody}
              autoFocus={shouldAutoFocusCompose}
            />
          )}
          <UpdatesFeed updates={(updates ?? []) as ProjectUpdate[]} />
        </section>
      </div>

      {/* Sidebar */}
      <aside className="space-y-6">
        <section>
          <h2 className="font-heading mb-3 text-base font-bold text-zinc-900 dark:text-zinc-100">
            Team
          </h2>
          <TeamList members={teamMembers} />
        </section>
      </aside>
    </div>
  )
}
