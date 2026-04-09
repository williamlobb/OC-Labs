import { notFound } from 'next/navigation'
import { ProjectHeader } from '@/components/projects/ProjectHeader'
import { ProjectActions } from '@/components/projects/ProjectActions'
import { ProjectTabs } from '@/components/projects/ProjectTabs'
import { ProjectChatPanel } from '@/components/chat/ProjectChatPanel'
import {
  getAuthenticatedUser,
  getCachedProject,
  getCachedUserMembership,
  getCachedUserVote,
} from '@/lib/data/project-queries'
import type { Project, MemberRole } from '@/types'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { id } = await params

  const user = await getAuthenticatedUser()

  const [project, userVote, userMembership] = await Promise.all([
    getCachedProject(id),
    getCachedUserVote(id, user?.id ?? ''),
    getCachedUserMembership(id, user?.id ?? ''),
  ])

  if (!project) notFound()

  const isOwner = project.owner_id === user?.id
  const membershipRole = (userMembership?.role ?? null) as MemberRole | null
  const hasVoted = !!userVote
  const hasRaisedHand = membershipRole === 'interested'
  const isChatMember = isOwner || !!userMembership

  return (
    <div className="w-full space-y-6 pb-[28rem]">
      <ProjectHeader project={project as Project} isOwner={isOwner} />

      <ProjectActions
        projectId={id}
        initialVoteCount={project.vote_count}
        initialHasVoted={hasVoted}
        initialHasRaisedHand={hasRaisedHand}
        initialMembershipRole={membershipRole}
        isOwner={isOwner}
      />

      <ProjectTabs projectId={id} isOwner={isOwner} />

      <div>{children}</div>

      {/* Persistent chat panel — only visible to project members */}
      {isChatMember && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pointer-events-none">
          <div className="mx-auto max-w-7xl pointer-events-auto">
            <ProjectChatPanel key={id} projectId={id} />
          </div>
        </div>
      )}
    </div>
  )
}
