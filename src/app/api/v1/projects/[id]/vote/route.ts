import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notifyMilestone } from '@/lib/notifications/slack'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user owns the project
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id, vote_count, title')
    .eq('id', id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (project.owner_id === user.id) {
    return NextResponse.json({ error: 'Cannot vote on your own project' }, { status: 403 })
  }

  // Check existing vote
  const { data: existingVote } = await supabase
    .from('votes')
    .select('project_id')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  let hasVoted: boolean
  let voteCount: number

  if (existingVote) {
    // Remove vote
    await supabase.from('votes').delete().eq('project_id', id).eq('user_id', user.id)
    const { data: updated } = await supabase.rpc('decrement_vote_count', { project_id: id })
    voteCount = updated ?? project.vote_count - 1
    hasVoted = false
  } else {
    // Add vote
    await supabase.from('votes').insert({ project_id: id, user_id: user.id })
    const { data: updated } = await supabase.rpc('increment_vote_count', { project_id: id })
    voteCount = updated ?? project.vote_count + 1
    hasVoted = true
  }

  // Notify when vote_count crosses 10 — fire and forget
  if (hasVoted && voteCount === 10) {
    notifyMilestone(project.title ?? '', `${project.title} just hit 10 votes!`).catch((err) =>
      console.error('Slack milestone notify failed:', err)
    )
  }

  return NextResponse.json({ voteCount, hasVoted })
}
