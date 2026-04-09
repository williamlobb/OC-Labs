import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import { IntegrationsPanel } from '@/components/settings/IntegrationsPanel'

export default async function IntegrationsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const role = await getPlatformRole(supabase, user.id)
  if (!isPowerUser(role)) notFound()

  const jiraBaseUrl = process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, '') ?? null
  const jiraProjectKey = process.env.JIRA_PROJECT_KEY?.trim() ?? null
  const jiraIssueType = process.env.JIRA_ISSUE_TYPE?.trim() ?? 'Task'
  const jiraConfigured = !!(jiraBaseUrl && process.env.JIRA_API_TOKEN && jiraProjectKey)
  const githubConfigured = !!process.env.GITHUB_TOKEN
  const githubOrg = process.env.GITHUB_ORG?.trim() ?? null

  // Get the most recent Jira sync timestamp across all tasks
  const { data: lastSyncRow } = jiraConfigured
    ? await supabase
        .from('tasks')
        .select('jira_synced_at')
        .not('jira_synced_at', 'is', null)
        .order('jira_synced_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Integrations</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage connections to external tools and services.
        </p>
      </div>
      <IntegrationsPanel
        jiraConfigured={jiraConfigured}
        jiraBaseUrl={jiraBaseUrl}
        jiraProjectKey={jiraProjectKey}
        jiraIssueType={jiraIssueType}
        jiraLastSync={(lastSyncRow as { jira_synced_at: string } | null)?.jira_synced_at ?? null}
        githubConfigured={githubConfigured}
        githubOrg={githubOrg}
      />
    </div>
  )
}
