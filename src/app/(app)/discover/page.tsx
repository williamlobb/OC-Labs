import { createServerSupabaseClient } from '@/lib/supabase/server'
import { FilterableBoard } from '@/components/board/FilterableBoard'
import Link from 'next/link'

export default async function DiscoverPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

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
  const projectsWithOwner = (projects ?? []).map((p: ProjectRow) => {
    const { users, ...rest } = p as ProjectRow & { users: { name?: string } | null }
    return {
      ...rest,
      owner_name: users?.name ?? 'Unknown',
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-900 dark:text-zinc-50">Discover</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Browse and vote on projects across the Omnia Collective.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New project
        </Link>
      </div>

      <FilterableBoard
        projects={projectsWithOwner}
        votedProjectIds={votedProjectIds}
        joinedProjectIds={joinedProjectIds}
      />
    </div>
  )
}
