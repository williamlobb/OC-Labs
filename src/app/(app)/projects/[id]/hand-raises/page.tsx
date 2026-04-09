import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { HandRaiseRequests } from '@/components/projects/HandRaiseRequests'
import {
  getAuthenticatedUser,
  getCachedProject,
  getCachedUserMembership,
} from '@/lib/data/project-queries'
import { canMemberRoleReviewHandRaises } from '@/lib/auth/permissions'
import type { MemberRole } from '@/types'

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
  const user = await getAuthenticatedUser()
  const project = await getCachedProject(id)

  if (!project) notFound()
  const membership = await (user ? getCachedUserMembership(id, user.id) : Promise.resolve(null))
  const viewerRole = (membership?.role ?? null) as MemberRole | null
  const canReviewHandRaises =
    project.owner_id === user?.id ||
    canMemberRoleReviewHandRaises(viewerRole)
  if (!canReviewHandRaises) notFound()

  const { data: raisedHands } = await supabaseAdmin
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
          Review hand raises, assign a role when approving, or deny the request.
        </p>
      </div>

      <HandRaiseRequests projectId={id} initialApplicants={applicants} />
    </section>
  )
}
