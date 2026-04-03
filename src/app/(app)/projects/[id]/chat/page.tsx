import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProjectChat } from '@/components/chat/ProjectChat'
import type { ChatMessage } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ChatPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="py-16 text-center text-sm text-zinc-500">Unauthorized.</div>

  const [{ data: project }, { data: membership }] = await Promise.all([
    supabase.from('projects').select('id, title').eq('id', id).single(),
    supabase
      .from('project_members')
      .select('role')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!project) notFound()

  if (!membership) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        You must be a project member to use the chat.
      </div>
    )
  }

  const { data: messages } = await supabase
    .from('project_chat_messages')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })
    .limit(50)

  return (
    <ProjectChat
      projectId={id}
      initialMessages={(messages ?? []) as ChatMessage[]}
    />
  )
}
