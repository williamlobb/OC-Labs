import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProjectHeader } from '@/components/projects/ProjectHeader'
import { ProjectActions } from '@/components/projects/ProjectActions'
import { ProjectTabs } from '@/components/projects/ProjectTabs'
import type { Project } from '@/types'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: project }, { data: userVote }, { data: userMembership }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
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

  if (!project) notFound()

  const isOwner = project.owner_id === user?.id
  const hasVoted = !!userVote
  const hasJoined = !!userMembership

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ProjectHeader project={project as Project} isOwner={isOwner} />

      <ProjectActions
        projectId={id}
        initialVoteCount={project.vote_count}
        initialHasVoted={hasVoted}
        initialHasJoined={hasJoined}
        isOwner={isOwner}
      />

      <ProjectTabs projectId={id} />

      <div>{children}</div>
    </div>
  )
}
