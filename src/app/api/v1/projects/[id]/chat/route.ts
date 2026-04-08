import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canEditProjectContent } from '@/lib/auth/permissions'
import { trimHistoryToBudget } from '@/lib/chat/trim-history'

export const runtime = 'edge'
export const maxDuration = 60
const AGENT_FETCH_TIMEOUT_MS = 45_000
const CHAT_HISTORY_CHAR_BUDGET = 8_000

// Normalise URL — strip trailing slash and ensure https. Both issues cause Go's mux
// to issue a 301 redirect which downgrades POST→GET, producing 405 Method Not Allowed.
const AGENT_URL = normalizeAgentURL(process.env.AGENT_URL ?? '')

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canEditProjectContent(supabase, user.id, id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const body = await req.json()
  const { message, history: clientHistory } = body
  if (!message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const trimmedMessage = message.trim()

  if (!AGENT_URL) {
    return NextResponse.json({ error: 'Agent not configured' }, { status: 503 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('github_repos')
    .eq('id', id)
    .single()

  const cookieHeader = req.headers.get('cookie') ?? ''
  const authToken = extractAuthToken(cookieHeader)

  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('host') ?? 'localhost:3000'
  const baseURL = `${proto}://${host}`

  let agentRes: Response
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), AGENT_FETCH_TIMEOUT_MS)
  try {
    const history = normalizeAndTrimHistory(clientHistory)

    agentRes = await fetch(`${AGENT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.signal,
      body: JSON.stringify({
        project_id: id,
        message: trimmedMessage,
        history,
        auth_token: authToken,
        base_url: baseURL,
        github_repos: project?.github_repos ?? [],
        is_owner: membership?.role === 'owner',
      }),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(
        {
          error:
            'Agent timed out while reviewing this request. Try narrowing scope (for example, specific files or folders).',
        },
        { status: 504 }
      )
    }
    return NextResponse.json({ error: 'Agent unavailable' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }

  if (!agentRes.ok || !agentRes.body) {
    const errText = await agentRes.text().catch(() => '')
    const cleaned = sanitizeUpstreamError(errText)
    return NextResponse.json(
      { error: cleaned || `Agent request failed (${agentRes.status})` },
      { status: 502 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const reader = agentRes.body!.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          controller.enqueue(encoder.encode(text))
        }
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
    const raw = chunked.map((c) => c.split('=').slice(1).join('=')).join('')
    return extractSupabaseAccessToken(raw)
  }

  // Single cookie: sb-xxx-auth-token=...
  const single = cookies.find((c) => c.includes('-auth-token='))
  return single ? extractSupabaseAccessToken(single.split('=').slice(1).join('=')) : ''
}

function normalizeAndTrimHistory(input: unknown): Array<{ role: 'user' | 'assistant'; content: string }> {
  const raw = Array.isArray(input) ? input : []
  const valid = raw
    .filter((item): item is { role: unknown; content: unknown } => typeof item === 'object' && item !== null)
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null,
      content: typeof item.content === 'string' ? item.content.trim() : '',
    }))
    .filter(
      (item): item is { role: 'user' | 'assistant'; content: string } =>
        item.role !== null && item.content.length > 0
    )

  const normalized = valid.reduce<Array<{ role: 'user' | 'assistant'; content: string }>>((acc, msg) => {
    if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
      acc[acc.length - 1] = msg
      return acc
    }
    acc.push(msg)
    return acc
  }, [])

  const withoutTrailingUser =
    normalized.length > 0 && normalized[normalized.length - 1].role === 'user'
      ? normalized.slice(0, -1)
      : normalized

  return trimHistoryToBudget(withoutTrailingUser, CHAT_HISTORY_CHAR_BUDGET) as Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

function sanitizeUpstreamError(input: string): string {
  const text = input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return ''
  return text.length > 300 ? `${text.slice(0, 300)}...` : text
}

function normalizeAgentURL(raw: string): string {
  let value = raw.trim()
  if (!value) return ''

  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    value = `https://${value}`
  }

  value = value.replace(/^http:\/\//, 'https://')
  value = value.replace(/\/$/, '')
  value = value.replace(/\/chat$/, '')
  return value
}

function extractSupabaseAccessToken(rawValue: string): string {
  const direct = rawValue.trim().replace(/^"|"$/g, '')
  if (looksLikeJwt(direct)) return direct

  const decoded = safelyDecodeURIComponent(direct)
  if (looksLikeJwt(decoded)) return decoded

  for (const candidate of [direct, decoded]) {
    const fromJson = parseSessionCandidate(candidate)
    if (fromJson) return fromJson
  }

  return decoded || direct
}

function parseSessionCandidate(value: string): string {
  const normalized = value.trim().replace(/^"|"$/g, '')
  const maybeBase64 = normalized.startsWith('base64-')
    ? decodeBase64Url(normalized.slice('base64-'.length))
    : normalized

  try {
    const parsed = JSON.parse(maybeBase64) as unknown

    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && looksLikeJwt(parsed[0])) {
      return parsed[0]
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      'access_token' in parsed &&
      typeof (parsed as { access_token?: unknown }).access_token === 'string'
    ) {
      const token = (parsed as { access_token: string }).access_token
      if (looksLikeJwt(token)) return token
    }
  } catch {
    return ''
  }

  return ''
}

function looksLikeJwt(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

function safelyDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function decodeBase64Url(value: string): string {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return atob(padded)
  } catch {
    return value
  }
}
