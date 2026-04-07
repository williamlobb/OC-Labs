import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { trimHistoryToBudget } from '@/lib/chat/trim-history'
import Anthropic from '@anthropic-ai/sdk'

const AGENT_URL = process.env.AGENT_URL // undefined in production until agent is deployed
const HISTORY_CHAR_BUDGET = 24_000

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const trimmedMessage = message.trim()

  // Load project + history
  const [{ data: project }, { data: historyRows }] = await Promise.all([
    supabase.from('projects').select('github_repos').eq('id', id).single(),
    supabase
      .from('project_chat_messages')
      .select('role, content')
      .eq('project_id', id)
      .order('created_at', { ascending: true })
      .limit(50),
  ])

  // Save user message
  await supabaseAdmin.from('project_chat_messages').insert({
    project_id: id,
    role: 'user',
    content: trimmedMessage,
    author_id: user.id,
  })

  // Route to Go agent if deployed, otherwise fall back to direct Anthropic
  if (AGENT_URL) {
    return proxyToAgent({
      req, id, project, historyRows, trimmedMessage, user, AGENT_URL,
    })
  }

  return directAnthropic({ id, project, historyRows, trimmedMessage, supabase })
}

// --- Go agent proxy (used when AGENT_URL is set) ---

async function proxyToAgent({
  req, id, project, historyRows, trimmedMessage, user, AGENT_URL,
}: {
  req: NextRequest
  id: string
  project: { github_repos: string[] } | null
  historyRows: { role: string; content: string }[] | null
  trimmedMessage: string
  user: { id: string }
  AGENT_URL: string
}): Promise<Response> {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const authCookie = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('sb-') && c.includes('-auth-token='))
  const authToken = authCookie?.split('=').slice(1).join('=') ?? ''

  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const host = req.headers.get('host') ?? 'localhost:3000'
  const baseURL = `${proto}://${host}`

  const agentRes = await fetch(`${AGENT_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: id,
      message: trimmedMessage,
      history: (historyRows ?? []).map((m) => ({ role: m.role, content: m.content })),
      auth_token: authToken,
      base_url: baseURL,
      github_repos: project?.github_repos ?? [],
    }),
  })

  if (!agentRes.ok || !agentRes.body) {
    const errText = await agentRes.text().catch(() => 'Agent unavailable')
    return NextResponse.json({ error: errText }, { status: 502 })
  }

  const encoder = new TextEncoder()
  let fullResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const reader = agentRes.body!.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          fullResponse += text
          controller.enqueue(encoder.encode(text))
        }
        if (fullResponse) {
          await supabaseAdmin.from('project_chat_messages').insert({
            project_id: id,
            role: 'assistant',
            content: fullResponse,
            author_id: null,
          })
        }
        controller.close()
      } catch (err) {
        if (fullResponse) {
          await supabaseAdmin.from('project_chat_messages').insert({
            project_id: id,
            role: 'assistant',
            content: fullResponse,
            author_id: null,
          })
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

// --- Direct Anthropic fallback (used until Go agent is deployed) ---

async function directAnthropic({
  id, project, historyRows, trimmedMessage, supabase,
}: {
  id: string
  project: { github_repos: string[] } | null
  historyRows: { role: string; content: string }[] | null
  trimmedMessage: string
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
}): Promise<Response> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const [{ data: projectFull }, { data: members }, { data: blocks }] = await Promise.all([
    supabase.from('projects').select('id, title, summary, status, skills_needed').eq('id', id).single(),
    supabase.from('project_members').select('role, users(name)').eq('project_id', id),
    supabase.from('context_blocks').select('title, body, block_type').eq('project_id', id).order('created_at', { ascending: true }),
  ])

  type MemberRow = { role: string; users: { name: string } | { name: string }[] | null }
  const teamLines = (members ?? []).map((m: MemberRow) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users
    return `- ${u?.name ?? 'Unknown'} (${m.role})`
  })

  const blockLines = (blocks ?? []).map(
    (b) => `### [${b.block_type.toUpperCase()}] ${b.title}\n${b.body}`
  )

  const systemPrompt = `You are an AI assistant for the project "${projectFull?.title}".

Project summary: ${projectFull?.summary ?? 'No summary provided.'}
Status: ${projectFull?.status}
Skills needed: ${(projectFull?.skills_needed ?? []).join(', ') || 'None listed'}

Team:
${teamLines.join('\n') || '- No team members listed'}

${blockLines.length > 0 ? `Context:\n${blockLines.join('\n\n')}` : ''}

Answer questions about this project concisely.`

  const trimmedHistory = trimHistoryToBudget(historyRows ?? [], HISTORY_CHAR_BUDGET)
  const messages: Anthropic.MessageParam[] = [
    ...trimmedHistory.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: trimmedMessage },
  ]

  const encoder = new TextEncoder()
  let fullResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        })

        for await (const chunk of anthropicStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text
            fullResponse += text
            controller.enqueue(encoder.encode(text))
          }
        }

        await supabaseAdmin.from('project_chat_messages').insert({
          project_id: id,
          role: 'assistant',
          content: fullResponse,
          author_id: null,
        })
        controller.close()
      } catch (err) {
        if (fullResponse) {
          await supabaseAdmin.from('project_chat_messages').insert({
            project_id: id,
            role: 'assistant',
            content: fullResponse,
            author_id: null,
          })
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
