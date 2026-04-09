/**
 * React.cache() wrappers for per-request deduplication of common project queries.
 *
 * When layout.tsx and a child page both call getCachedProject(id) in the same
 * server render, only one DB round-trip is made. Next.js resets the cache
 * between requests, so stale data is never served.
 */
import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPlatformRole } from '@/lib/auth/permissions'

export const getAuthenticatedUser = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getCachedProject = cache(async (id: string) => {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.from('projects').select('*').eq('id', id).single()
  return data
})

export const getCachedUserMembership = cache(async (projectId: string, userId: string) => {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
})

export const getCachedUserVote = cache(async (projectId: string, userId: string) => {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('votes')
    .select('project_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
})

export const getCachedPlatformRole = cache(async (userId: string) => {
  const supabase = await createServerSupabaseClient()
  return getPlatformRole(supabase, userId)
})
