import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProjectHeader } from '@/components/projects/ProjectHeader'
import { TeamList } from '@/components/projects/TeamList'
import { UpdatesFeed } from '@/components/projects/UpdatesFeed'
import { RepoPreview } from '@/components/projects/RepoPreview'
import type { MemberRole, ProjectUpdate } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const [{ data: members }, { data: updates }, { data: userVote }, { data: userMembership }] =
    await Promise.all([
      supabase
        .from('project_members')
        .select('user_id, role, users(name, profile_photo_url)')
        .eq('project_id', id),
      supabase
        .from('updates')
        .select('*')
        .eq('project_id', id)
        .order('posted_at', { ascending: false }),
      supabase
        .from('votes')
        .select('project_id')
        .eq('project_id', id)
        .eq('user_id', user?.id ?? '')
        .maybeSingle(),
      supabase
        .from('project_members')
        .select('role')
        .eq('project_id', id)
        .eq('user_id', user?.id ?? '')
        .maybeSingle(),
    ])

  const isOwner = project.owner_id === user?.id
  const hasVoted = !!userVote
  const hasJoined = !!userMembership

  type MemberRow = {
    user_id: string
    role: MemberRole
    // Supabase returns joined rows as arrays when using select with relation
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
    <div className="mx-auto max-w-4xl space-y-10">
      <ProjectHeader project={project} isOwner={isOwner} />

      {/* Vote + Raise Hand actions */}
      <div className="flex gap-3">
        <form action={`/api/v1/projects/${id}/vote`} method="POST">
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              hasVoted
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            {hasVoted ? `▲ Voted (${project.vote_count})` : `▲ Vote (${project.vote_count})`}
          </button>
        </form>
        {!isOwner && (
          <form action={`/api/v1/projects/${id}/raise-hand`} method="POST">
            <button
              type="submit"
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                hasJoined
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {hasJoined ? 'Joined ✓' : 'Raise Hand'}
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* GitHub repos */}
          {project.github_repos?.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
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
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Updates
            </h2>
            <UpdatesFeed updates={(updates ?? []) as ProjectUpdate[]} />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <section>
            <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Team
            </h2>
            <TeamList members={teamMembers} />
          </section>
        </aside>
      </div>
    </div>
  )
}
