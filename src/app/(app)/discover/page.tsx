import { createServerSupabaseClient } from '@/lib/supabase/server'
import { FilterableBoard } from '@/components/board/FilterableBoard'
import { DiscoverChatPanel } from '@/components/chat/DiscoverChatPanel'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import Link from 'next/link'

export default async function DiscoverPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  const platformRole = user ? await getPlatformRole(supabase, user.id) : 'user'
  const canCreate = isPowerUser(platformRole)

  // Fetch all projects ordered by vote_count desc
  const { data: projects } = await supabase
    .from('projects')
    .select('*, users!projects_owner_id_fkey(name)')
    .order('vote_count', { ascending: false })

  // Fetch current user's votes and memberships
  const [{ data: votes }, { data: memberships }] = await Promise.all([
    supabase
      .from('votes')
      .select('project_id')
      .eq('user_id', user?.id ?? ''),
    supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user?.id ?? ''),
  ])

  const votedProjectIds = (votes ?? []).map((v: { project_id: string }) => v.project_id)
  const joinedProjectIds = (memberships ?? []).map((m: { project_id: string }) => m.project_id)

  type ProjectRow = typeof projects extends (infer T)[] | null ? T : never
  type ProjectMemberRow = {
    project_id: string
    user_id: string
    users: { name?: string; profile_photo_url?: string | null }[] | { name?: string; profile_photo_url?: string | null } | null
  }

  const projectIds = (projects ?? []).map((p: ProjectRow) => p.id)
  const teamMembersByProject = new Map<
    string,
    { id: string; name: string; profile_photo_url?: string | null }[]
  >()

  if (projectIds.length > 0) {
    const { data: projectMembers } = await supabase
      .from('project_members')
      .select('project_id, user_id, users(name, profile_photo_url)')
      .in('project_id', projectIds)
      .in('role', ['owner', 'contributor', 'observer', 'tech_lead'])

    for (const member of (projectMembers ?? []) as ProjectMemberRow[]) {
      const userRecord = Array.isArray(member.users) ? member.users[0] : member.users
      const next = teamMembersByProject.get(member.project_id) ?? []
      next.push({
        id: member.user_id,
        name: userRecord?.name ?? 'Unknown',
        profile_photo_url: userRecord?.profile_photo_url ?? null,
      })
      teamMembersByProject.set(member.project_id, next)
    }
  }

  const projectsWithOwner = (projects ?? []).map((p: ProjectRow) => {
    const { users, ...rest } = p as ProjectRow & { users: { name?: string } | null }
    const teamMembersPreview = (teamMembersByProject.get(p.id) ?? []).filter(
      (member) => member.id !== (p.owner_id ?? '')
    )
    return {
      ...rest,
      owner_name: users?.name ?? 'Unknown',
      team_members_preview: teamMembersPreview,
    }
  })

  return (
    <div className="space-y-6 pb-[22rem]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-900 dark:text-zinc-50">Discover</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Browse and vote on projects across the Omnia Collective.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/projects/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            New project
          </Link>
        )}
      </div>

      <FilterableBoard
        projects={projectsWithOwner}
        votedProjectIds={votedProjectIds}
        joinedProjectIds={joinedProjectIds}
      />

      {/* Persistent project-creation assistant — power_user only */}
      {canCreate && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pointer-events-none">
          <div className="mx-auto max-w-7xl pointer-events-auto">
            <DiscoverChatPanel />
          </div>
        </div>
      )}
    </div>
  )
}
