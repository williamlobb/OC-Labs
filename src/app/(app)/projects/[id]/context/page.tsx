import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ContextWorkbench } from '@/components/context/ContextWorkbench'
import { buildContextAttachmentUrl } from '@/lib/context/attachments'
import { canMemberRoleEditProjectContent, isPowerUser } from '@/lib/auth/permissions'
import {
  getAuthenticatedUser,
  getCachedPlatformRole,
  getCachedProject,
  getCachedUserMembership,
} from '@/lib/data/project-queries'
import type { ContextBlock, MemberRole } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ContextPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const user = await getAuthenticatedUser()
  const project = await getCachedProject(id)

  if (!project) notFound()

  const [{ data: blocks }, membership, platformRole] = await Promise.all([
    supabase
      .from('context_blocks')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    getCachedUserMembership(id, user?.id ?? ''),
    user ? getCachedPlatformRole(user.id) : Promise.resolve<'user'>('user'),
  ])

  const viewerRole = (membership?.role ?? null) as MemberRole | null
  const canEdit = isPowerUser(platformRole) || canMemberRoleEditProjectContent(viewerRole)
  const initialBlocks = ((blocks ?? []) as ContextBlock[]).map((block) => ({
    ...block,
    attachment_url: buildContextAttachmentUrl(block.attachment_path),
  }))

  return (
    <ContextWorkbench
      projectId={id}
      initialBlocks={initialBlocks}
      canEdit={canEdit}
    />
  )
}
