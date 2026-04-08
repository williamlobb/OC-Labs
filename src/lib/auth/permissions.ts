import { SupabaseClient } from '@supabase/supabase-js'
import { MemberRole, PlatformRole } from '@/types'

const CONTENT_ROLES: MemberRole[] = ['owner', 'tech_lead', 'contributor']

/**
 * Fetches the user's platform_role from the users table.
 * Returns 'user' as safe default if column is missing or query fails.
 */
export async function getPlatformRole(
  supabase: SupabaseClient,
  userId: string
): Promise<PlatformRole> {
  const { data, error } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', userId)
    .single()

  if (error) {
    console.warn('[permissions] getPlatformRole query failed, defaulting to user:', error.message)
  }

  const role = data?.platform_role as PlatformRole | null | undefined
  return role ?? 'user'
}

/** Returns true if the role grants platform-wide admin access */
export function isPowerUser(role: PlatformRole): boolean {
  return role === 'power_user'
}

/**
 * Can user edit project content (context blocks, tasks, plan, updates, chat)?
 * True if: power_user OR project member with role in [owner, tech_lead, contributor]
 */
export async function canEditProjectContent(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getPlatformRole(supabase, userId)
  if (isPowerUser(role)) return true

  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()

  const memberRole = data?.role as MemberRole | null | undefined
  return memberRole !== undefined && memberRole !== null && CONTENT_ROLES.includes(memberRole)
}

/**
 * Can user edit project settings (title, description, status, notion_url, jira_epic_key)?
 * True if: power_user OR owner_id matches
 */
export async function canEditProjectSettings(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getPlatformRole(supabase, userId)
  if (isPowerUser(role)) return true

  const { data } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  return data?.owner_id === userId
}

/**
 * Can user manage members (approve, add, remove)?
 * True if: power_user OR project owner
 */
export async function canManageMembers(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getPlatformRole(supabase, userId)
  if (isPowerUser(role)) return true

  const { data } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  return data?.owner_id === userId
}

/**
 * Can user create a project?
 * True if: any authenticated user (all roles can submit ideas for review)
 */
export async function canCreateProject(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  return !!userId
}

/**
 * Can user delete a project?
 * True if: power_user OR owner_id matches
 */
export async function canDeleteProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getPlatformRole(supabase, userId)
  if (isPowerUser(role)) return true

  const { data } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  return data?.owner_id === userId
}
