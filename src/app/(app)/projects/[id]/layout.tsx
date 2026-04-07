import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProjectHeader } from '@/components/projects/ProjectHeader'
import { ProjectActions } from '@/components/projects/ProjectActions'
import { ProjectTabs } from '@/components/projects/ProjectTabs'
import { ProjectChat } from '@/components/chat/ProjectChat'
import type { Project, ChatMessage } from '@/types'

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
  const hasVoted = !!userVote
  const hasJoined = !!userMembership
  const isChatMember = isOwner || !!userMembership

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-[28rem]">
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

      {/* Persistent chat panel — visible across all tabs */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl">
          {isChatMember ? (
            <div className="h-96">
              <div className="flex items-center border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Project Chat</span>
              </div>
              <div className="h-[calc(100%-2.5rem)]">
                <ProjectChat
                  projectId={id}
                  initialMessages={(chatMessages ?? []) as ChatMessage[]}
                />
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 text-center text-xs text-zinc-400">
              Join this project to access chat.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
