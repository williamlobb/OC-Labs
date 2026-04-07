import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseRepoRef, fetchFileContent } from '@/lib/github/repo'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const { searchParams } = req.nextUrl

  const repoParam = searchParams.get('repo')
  const path = searchParams.get('path')

  if (!repoParam || !path) {
    return NextResponse.json({ error: 'repo and path query params are required' }, { status: 400 })
  }

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

  // Validate the requested repo is actually linked to this project
  const repos: string[] = project.github_repos ?? []
  const ref = parseRepoRef(repoParam)
  if (!ref) return NextResponse.json({ error: 'Invalid repo format' }, { status: 400 })

  const isLinked = repos.some((r) => {
    const linked = parseRepoRef(r)
    return linked?.fullName.toLowerCase() === ref.fullName.toLowerCase()
  })

  if (!isLinked) {
    return NextResponse.json({ error: 'Repo not linked to this project' }, { status: 403 })
  }

  const content = await fetchFileContent(ref.owner, ref.repo, path)
  if (content === null) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return NextResponse.json({ repo: ref.fullName, path, content })
}
