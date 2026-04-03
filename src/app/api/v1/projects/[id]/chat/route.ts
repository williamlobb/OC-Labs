import { NextRequest, NextResponse } from 'next/server'
import { trimHistoryToBudget } from '@/lib/chat/trim-history'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Rough character budget to avoid exceeding the model's context window.
// ~4 chars per token; keep history under ~6 000 tokens of the 8 192 context.
const HISTORY_CHAR_BUDGET = 24_000

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
  const [
    { data: project, error: projectError },
    { data: members },
    { data: blocks },
  ] = await Promise.all([
    supabase.from('projects').select('id, title, summary, status, skills_needed').eq('id', id).single(),
    supabase.from('project_members').select('role, users(name)').eq('project_id', id),
    supabase.from('context_blocks').select('title, body, block_type').eq('project_id', id).order('created_at', { ascending: true }),
  ])

  if (projectError || !project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

  // Load last 50 messages for history, then trim to the character budget so we
  // don't silently overflow the model's context window.
  const { data: historyRows } = await supabase
    .from('project_chat_messages')
    .select('role, content')
    .eq('project_id', id)
    .order('created_at', { ascending: true })
    .limit(50)

  const trimmedHistory = trimHistoryToBudget(historyRows ?? [], HISTORY_CHAR_BUDGET)

  const messages: Anthropic.MessageParam[] = [
    ...trimmedHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message.trim() },
  ]

  const trimmedMessage = message.trim()

  // Stream response — user and assistant messages are both saved inside the
  // stream callback so they are written atomically relative to the exchange.
  const encoder = new TextEncoder()
  let fullResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      // Save user message before streaming so history is consistent even if
      // the stream is aborted after partial delivery.
      await supabaseAdmin.from('project_chat_messages').insert({
        project_id: id,
        role: 'user',
        content: trimmedMessage,
        author_id: user.id,
      })

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

        // Save assistant message after stream completes successfully
        await supabaseAdmin.from('project_chat_messages').insert({
          project_id: id,
          role: 'assistant',
          content: fullResponse,
          author_id: null,
        })

        controller.close()
      } catch (err) {
        // If the assistant response was partially accumulated, persist what we
        // have so history is not left with an orphaned user message.
        if (fullResponse) {
          await supabaseAdmin.from('project_chat_messages').insert({
            project_id: id,
            role: 'assistant',
            content: fullResponse,
            author_id: null,
          }).catch(() => {})
        }
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
