import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TaskBoard } from '@/components/plan/TaskBoard'
import type { Task, MemberRole } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PlanPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: project }, { data: tasks }, { data: members }, { data: membership }] =
    await Promise.all([
      supabase.from('projects').select('id, title').eq('id', id).single(),
      supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_members')
        .select('user_id, role, users(name)')
        .eq('project_id', id),
      supabase
        .from('project_members')
        .select('role')
        .eq('project_id', id)
        .eq('user_id', user?.id ?? '')
        .maybeSingle(),
    ])

  if (!project) notFound()

  const canEdit = !!membership && ['owner', 'contributor'].includes(membership.role)
  const viewerRole = (membership?.role ?? null) as MemberRole | null

  type MemberRow = {
    user_id: string
    role: MemberRole
    users: { name: string } | { name: string }[] | null
  }

  const teamMembers = (members ?? []).map((m: MemberRow) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users
    return { user_id: m.user_id, name: u?.name ?? 'Unknown' }
  })

  return (
    <TaskBoard
      projectId={id}
      initialTasks={(tasks ?? []) as Task[]}
      teamMembers={teamMembers}
      canEdit={canEdit}
      viewerRole={viewerRole}
    />
  )
}
