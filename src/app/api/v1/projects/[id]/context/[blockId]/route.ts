import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  buildContextAttachmentPath,
  buildContextAttachmentUrl,
  CONTEXT_ATTACHMENTS_BUCKET,
  isFileLike,
  MAX_CONTEXT_ATTACHMENT_BYTES,
  normalizeContextAttachmentError,
} from '@/lib/context/attachments'
import type { BlockType } from '@/types'

const BLOCK_TYPES = new Set<BlockType>(['general', 'architecture', 'decision', 'constraint'])

interface ContextPayload {
  title?: string
  body?: string
  blockType?: string
  attachment?: File | null
}

function readString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function withAttachmentUrl<T extends { attachment_path?: string | null }>(block: T): T & { attachment_url: string | null } {
  return {
    ...block,
    attachment_url: buildContextAttachmentUrl(block.attachment_path),
  }
}

async function parsePayload(req: NextRequest): Promise<ContextPayload> {
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const attachmentCandidate = formData.get('attachment')
    const attachment = isFileLike(attachmentCandidate) && attachmentCandidate.size > 0
      ? attachmentCandidate
      : null

    return {
      title: readString(formData.get('title')),
      body: readString(formData.get('body')),
      blockType: readString(formData.get('block_type')),
      attachment,
    }
  }

  const json = await req.json().catch(() => ({})) as Record<string, unknown>

  return {
    title: typeof json.title === 'string' ? json.title : undefined,
    body: typeof json.body === 'string' ? json.body : undefined,
    blockType: typeof json.block_type === 'string' ? json.block_type : undefined,
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
): Promise<NextResponse> {
  const { id, blockId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['owner', 'contributor'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = await parsePayload(req)
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const title = payload.title?.trim()
  if (title) updates.title = title

  const description = payload.body?.trim()
  if (description) updates.body = description

  if (payload.blockType) {
    if (!BLOCK_TYPES.has(payload.blockType as BlockType)) {
      return NextResponse.json({ error: 'Invalid block_type' }, { status: 400 })
    }

    updates.block_type = payload.blockType
  }

  if (payload.attachment && payload.attachment.size > MAX_CONTEXT_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: 'Attachment must be 20MB or smaller' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('context_blocks')
    .select('version, attachment_path')
    .eq('id', blockId)
    .eq('project_id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let nextAttachmentPath: string | null = null

  if (payload.attachment) {
    nextAttachmentPath = buildContextAttachmentPath(id, payload.attachment.name || 'attachment')
    const { error: uploadError } = await supabase.storage
      .from(CONTEXT_ATTACHMENTS_BUCKET)
      .upload(nextAttachmentPath, payload.attachment, {
        contentType: payload.attachment.type || 'application/octet-stream',
      })

    if (uploadError) {
      return NextResponse.json({ error: normalizeContextAttachmentError(uploadError.message) }, { status: 500 })
    }

    updates.attachment_name = payload.attachment.name
    updates.attachment_path = nextAttachmentPath
    updates.attachment_mime_type = payload.attachment.type || 'application/octet-stream'
    updates.attachment_size_bytes = payload.attachment.size
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  updates.version = (existing.version ?? 1) + 1

  const { data: block, error } = await supabase
    .from('context_blocks')
    .update(updates)
    .eq('id', blockId)
    .eq('project_id', id)
    .select('*')
    .single()

  if (error) {
    if (nextAttachmentPath) {
      await supabase.storage.from(CONTEXT_ATTACHMENTS_BUCKET).remove([nextAttachmentPath])
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (nextAttachmentPath && existing.attachment_path) {
    await supabase.storage.from(CONTEXT_ATTACHMENTS_BUCKET).remove([existing.attachment_path])
  }

  return NextResponse.json(withAttachmentUrl(block))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
): Promise<NextResponse> {
  const { id, blockId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['owner', 'contributor'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: block } = await supabase
    .from('context_blocks')
    .select('id, attachment_path')
    .eq('id', blockId)
    .eq('project_id', id)
    .single()

  if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (block.attachment_path) {
    const { error: removeError } = await supabase.storage
      .from(CONTEXT_ATTACHMENTS_BUCKET)
      .remove([block.attachment_path])

    if (removeError) {
      return NextResponse.json({ error: normalizeContextAttachmentError(removeError.message) }, { status: 500 })
    }
  }

  const { error } = await supabase
    .from('context_blocks')
    .delete()
    .eq('id', blockId)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
