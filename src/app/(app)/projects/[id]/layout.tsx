import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProjectHeader } from '@/components/projects/ProjectHeader'
import { ProjectActions } from '@/components/projects/ProjectActions'
import { ProjectTabs } from '@/components/projects/ProjectTabs'
import { ProjectChatPanel } from '@/components/chat/ProjectChatPanel'
import type { Project, ChatMessage, MemberRole } from '@/types'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: project }, { data: userVote }, { data: userMembership }, { data: chatMessages }] = await Promise.all([
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
    supabase
      .from('project_chat_messages')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true })
      .limit(50),
  ])

  if (!project) notFound()

  const isOwner = project.owner_id === user?.id
  const membershipRole = (userMembership?.role ?? null) as MemberRole | null
  const hasVoted = !!userVote
  const hasRaisedHand = membershipRole === 'interested'
  const isChatMember = isOwner || !!userMembership

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-[28rem]">
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

      {/* Persistent chat panel — visible across all tabs */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pointer-events-none">
        <div className="mx-auto max-w-4xl pointer-events-auto">
          {isChatMember ? (
            <ProjectChatPanel
              projectId={id}
              initialMessages={(chatMessages ?? []) as ChatMessage[]}
            />
          ) : (
            <div className="rounded-2xl border border-white/30 bg-white/70 px-4 py-3 text-center text-xs text-zinc-400 shadow-2xl backdrop-blur-xl dark:border-zinc-700/40 dark:bg-zinc-900/70">
              Join this project to access chat.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
