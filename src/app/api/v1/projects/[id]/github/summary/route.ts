import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  parseRepoRef,
  fetchRepoMetadata,
  fetchCommits,
  fetchDeployments,
} from '@/lib/github/repo'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase
    .from('projects')
    .select('owner_id, github_repos')
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

  const repos: string[] = project.github_repos ?? []

  if (repos.length === 0) {
    return NextResponse.json({ repos: [] })
  }

  const results = await Promise.all(
    repos.map(async (repoValue) => {
      const ref = parseRepoRef(repoValue)
      if (!ref) return { repo: repoValue, error: 'Could not parse repo ref' }

      const [meta, commits, deployments] = await Promise.all([
        fetchRepoMetadata(`https://github.com/${ref.fullName}`),
        fetchCommits(ref.owner, ref.repo, 3),
        fetchDeployments(ref.owner, ref.repo),
      ])

      return {
        repo: ref.fullName,
        description: meta?.description ?? null,
        language: meta?.language ?? null,
        lastDeployment: deployments[0] ?? null,
        recentCommits: commits,
      }
    }),
  )

  return NextResponse.json({ repos: results })
}
