import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { HandRaiseRequests } from '@/components/projects/HandRaiseRequests'
import { getAuthenticatedUser, getCachedProject } from '@/lib/data/project-queries'

interface PageProps {
  params: Promise<{ id: string }>
}

type MemberRow = {
  user_id: string
  joined_at: string
  users: { name: string; profile_photo_url: string | null }[] | { name: string; profile_photo_url: string | null } | null
}

export default async function HandRaisesPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const user = await getAuthenticatedUser()
  const project = await getCachedProject(id)

  if (!project) notFound()
  if (project.owner_id !== user?.id) notFound()

  const { data: raisedHands } = await supabase
    .from('project_members')
    .select('user_id, joined_at, users(name, profile_photo_url)')
    .eq('project_id', id)
    .eq('role', 'interested')
    .order('joined_at', { ascending: false })

  const applicants = (raisedHands ?? []).map((member: MemberRow) => {
    const profile = Array.isArray(member.users) ? member.users[0] : member.users
    return {
      user_id: member.user_id,
      name: profile?.name ?? 'Unknown',
      profile_photo_url: profile?.profile_photo_url ?? null,
      raised_at: member.joined_at,
    }
  })

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-base font-bold text-zinc-900 dark:text-zinc-100">
          Hand Raises
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Approve people who raised their hand to join this project.
        </p>
      </div>

      <HandRaiseRequests projectId={id} initialApplicants={applicants} />
    </section>
  )
}
