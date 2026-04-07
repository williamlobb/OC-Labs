import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'edge'
export const maxDuration = 60

// Normalise URL — strip trailing slash and ensure https. Both issues cause Go's mux
// to issue a 301 redirect which downgrades POST→GET, producing 405 Method Not Allowed.
const AGENT_URL = (process.env.AGENT_URL ?? '')
  .replace(/^http:\/\//, 'https://')
  .replace(/\/$/, '')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Gate on membership or ownership
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (project.owner_id !== user.id) {
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: messages } = await supabase
    .from('project_chat_messages')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })
    .limit(50)

  return NextResponse.json({ messages: messages ?? [] })
}

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

  if (!AGENT_URL) {
    return NextResponse.json({ error: 'Agent not configured' }, { status: 503 })
  }

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

  const cookieHeader = req.headers.get('cookie') ?? ''
  const authToken = extractAuthToken(cookieHeader)

  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
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
      github_tools: buildGithubToolsHint(id, project?.github_repos ?? [], baseURL),
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

/**
 * Extract the Supabase auth token value from the cookie header.
 * Supabase SSR may chunk large JWTs across multiple cookies with a `.N` suffix
 * (e.g. sb-xxx-auth-token.0, sb-xxx-auth-token.1). Reassemble them in order.
 */
function extractAuthToken(cookieHeader: string): string {
  const cookies = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith('sb-') && c.includes('-auth-token'))

  // Chunked cookies: sb-xxx-auth-token.0=..., sb-xxx-auth-token.1=...
  const chunked = cookies
    .filter((c) => /\.(\d+)=/.test(c))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\.(\d+)=/)?.[1] ?? '0', 10)
      const numB = parseInt(b.match(/\.(\d+)=/)?.[1] ?? '0', 10)
      return numA - numB
    })
  if (chunked.length > 0) {
    return chunked.map((c) => c.split('=').slice(1).join('=')).join('')
  }

  // Single cookie: sb-xxx-auth-token=...
  const single = cookies.find((c) => c.includes('-auth-token='))
  return single ? single.split('=').slice(1).join('=') : ''
}

/**
 * Describes the GitHub tools available to the agent for this project.
 * The agent should only call these when the user explicitly asks about the repo —
 * not proactively on every message.
 *
 * Tools:
 *   GET {base_url}/api/v1/projects/{id}/github/summary
 *     → repo description, language, last deployment status, last 3 commits
 *     Use when: user asks about repo status, recent changes, or deployment health.
 *
 *   GET {base_url}/api/v1/projects/{id}/github/file?repo={owner/repo}&path={path}
 *     → raw content of a specific file
 *     Use when: user asks to read or review a specific file.
 */
function buildGithubToolsHint(
  projectId: string,
  repos: string[],
  baseURL: string,
): { available: boolean; summaryUrl: string; fileUrl: string; repos: string[] } | null {
  if (repos.length === 0) return null
  return {
    available: true,
    summaryUrl: `${baseURL}/api/v1/projects/${projectId}/github/summary`,
    fileUrl: `${baseURL}/api/v1/projects/${projectId}/github/file`,
    repos,
  }
}
