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

  const jiraConfigured = !!(process.env.JIRA_BASE_URL && process.env.JIRA_API_TOKEN)
  const githubConfigured = !!process.env.GITHUB_TOKEN

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Integrations</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage connections to external tools and services.
        </p>
      </div>
      <IntegrationsPanel jiraConfigured={jiraConfigured} githubConfigured={githubConfigured} />
    </div>
  )
}
