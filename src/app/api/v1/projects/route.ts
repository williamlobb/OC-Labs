import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notifyNewProject } from '@/lib/notifications/slack-events'
import type { ProjectStatus } from '@/types'

const VALID_STATUSES: ProjectStatus[] = ['Idea', 'In progress', 'Needs help', 'Paused', 'Shipped']

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const status: ProjectStatus =
    VALID_STATUSES.includes(body.status as ProjectStatus)
      ? (body.status as ProjectStatus)
      : 'Idea'

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      title,
      summary: typeof body.summary === 'string' ? body.summary : null,
      status,
      owner_id: user.id,
      skills_needed: Array.isArray(body.skills_needed) ? body.skills_needed : [],
      github_repos: Array.isArray(body.github_repos) ? body.github_repos : [],
      notion_url: typeof body.notion_url === 'string' ? body.notion_url : null,
      needs_help: false,
      vote_count: 0,
    })
    .select()
    .single()

  if (error || !project) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Add owner as project member
  await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: user.id,
    role: 'owner',
  })

  // Fetch owner name for Slack notification
  const { data: ownerProfile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()

  // Notify Slack — fire and forget
  notifyNewProject(
    project.id,
    project.title,
    ownerProfile?.name ?? user.email ?? 'Unknown'
  ).catch((err) => console.error('Slack notify failed:', err))

  return NextResponse.json(project, { status: 201 })
}
