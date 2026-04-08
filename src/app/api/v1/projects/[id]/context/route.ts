import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canEditProjectContent } from '@/lib/auth/permissions'
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: project }, { data: members }, { data: blocks }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, summary, status, skills_needed, github_repos, notion_url')
      .eq('id', id)
      .single(),
    supabase
      .from('project_members')
      .select('role, users(name)')
      .eq('project_id', id),
    supabase
      .from('context_blocks')
      .select('id, title, body, block_type, version, author_id, author_name, attachment_name, attachment_path, attachment_mime_type, attachment_size_bytes, created_at, updated_at')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type MemberRow = { role: string; users: { name: string } | { name: string }[] | null }
  const team = (members ?? []).map((m: MemberRow) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users
    return { name: u?.name ?? 'Unknown', role: m.role }
  })

  return NextResponse.json({
    project: {
      id: project.id,
      title: project.title,
      summary: project.summary,
      status: project.status,
      skills_needed: project.skills_needed,
      github_repos: project.github_repos ?? [],
      notion_url: project.notion_url ?? null,
    },
    team,
    blocks: (blocks ?? []).map(withAttachmentUrl),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canEditProjectContent(supabase, user.id, id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = await parsePayload(req)
  const title = payload.title?.trim()
  const description = payload.body?.trim()
  const blockType = payload.blockType ?? 'general'

  if (!title || !description) {
    return NextResponse.json({ error: 'title and description are required' }, { status: 400 })
  }

  if (!BLOCK_TYPES.has(blockType as BlockType)) {
    return NextResponse.json({ error: 'Invalid block_type' }, { status: 400 })
  }

  if (payload.attachment && payload.attachment.size > MAX_CONTEXT_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: 'Attachment must be 20MB or smaller' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()

  const authorName = profile?.name?.trim() || 'Unknown'

  let attachmentPath: string | null = null

  if (payload.attachment) {
    attachmentPath = buildContextAttachmentPath(id, payload.attachment.name || 'attachment')
    const { error: uploadError } = await supabase.storage
      .from(CONTEXT_ATTACHMENTS_BUCKET)
      .upload(attachmentPath, payload.attachment, {
        contentType: payload.attachment.type || 'application/octet-stream',
      })

    if (uploadError) {
      return NextResponse.json({ error: normalizeContextAttachmentError(uploadError.message) }, { status: 500 })
    }
  }

  const { data: block, error } = await supabase
    .from('context_blocks')
    .insert({
      project_id: id,
      author_id: user.id,
      author_name: authorName,
      title,
      body: description,
      block_type: blockType,
      attachment_name: payload.attachment?.name ?? null,
      attachment_path: attachmentPath,
      attachment_mime_type: payload.attachment?.type || (payload.attachment ? 'application/octet-stream' : null),
      attachment_size_bytes: payload.attachment?.size ?? null,
    })
    .select('*')
    .single()

  if (error) {
    if (attachmentPath) {
      await supabase.storage.from(CONTEXT_ATTACHMENTS_BUCKET).remove([attachmentPath])
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(withAttachmentUrl(block), { status: 201 })
}
