import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only project members can chat
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { message } = body
  if (!message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  // Build system prompt from MCP context
  const [{ data: project }, { data: members }, { data: blocks }] = await Promise.all([
    supabase.from('projects').select('id, title, summary, status, skills_needed').eq('id', id).single(),
    supabase.from('project_members').select('role, users(name)').eq('project_id', id),
    supabase.from('context_blocks').select('title, body, block_type').eq('project_id', id).order('created_at', { ascending: true }),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type MemberRow = { role: string; users: { name: string } | { name: string }[] | null }
  const teamLines = (members ?? []).map((m: MemberRow) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users
    return `- ${u?.name ?? 'Unknown'} (${m.role})`
  })

  const blockLines = (blocks ?? []).map(
    (b) => `### [${b.block_type.toUpperCase()}] ${b.title}\n${b.body}`
  )

  const systemPrompt = `You are an AI assistant for the project "${project.title}".

Project summary: ${project.summary ?? 'No summary provided.'}
Status: ${project.status}
Skills needed: ${(project.skills_needed ?? []).join(', ') || 'None listed'}

Team:
${teamLines.join('\n') || '- No team members listed'}

${blockLines.length > 0 ? `Context:\n${blockLines.join('\n\n')}` : ''}

Answer questions about this project concisely. Use the context above to ground your responses.`

  // Load last 50 messages for history
  const { data: history } = await supabase
    .from('project_chat_messages')
    .select('role, content')
    .eq('project_id', id)
    .order('created_at', { ascending: true })
    .limit(50)

  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message.trim() },
  ]

  // Save user message
  await supabaseAdmin.from('project_chat_messages').insert({
    project_id: id,
    role: 'user',
    content: message.trim(),
    author_id: user.id,
  })

  // Stream response
  const encoder = new TextEncoder()
  let fullResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        })

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const text = chunk.delta.text
            fullResponse += text
            controller.enqueue(encoder.encode(text))
          }
        }

        // Save assistant message after stream completes
        await supabaseAdmin.from('project_chat_messages').insert({
          project_id: id,
          role: 'assistant',
          content: fullResponse,
          author_id: null,
        })

        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
