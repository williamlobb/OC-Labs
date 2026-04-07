import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ContextWorkbench } from '@/components/context/ContextWorkbench'
import { buildContextAttachmentUrl } from '@/lib/context/attachments'
import type { ContextBlock } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ContextPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: project }, { data: blocks }, { data: membership }] = await Promise.all([
    supabase.from('projects').select('id, title').eq('id', id).single(),
    supabase
      .from('context_blocks')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('project_members')
      .select('role')
      .eq('project_id', id)
      .eq('user_id', user?.id ?? '')
      .maybeSingle(),
  ])

  if (!project) notFound()

  const canEdit = !!membership && ['owner', 'contributor'].includes(membership.role)
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
