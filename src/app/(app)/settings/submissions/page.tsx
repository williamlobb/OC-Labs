import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import SubmissionsQueuePanel from '@/components/admin/SubmissionsQueuePanel'

interface SubmissionRow {
  id: string
  title: string
  summary: string | null
  status: string | null
  created_at: string
  skills_needed: string[] | null
  users: { name?: string | null; email?: string | null } | { name?: string | null; email?: string | null }[] | null
}

export default async function SubmissionsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const role = await getPlatformRole(supabase, user.id)
  if (!isPowerUser(role)) notFound()

  const { data } = await supabaseAdmin
    .from('projects')
    .select('id, title, summary, status, created_at, skills_needed, users!projects_owner_id_fkey(name, email)')
    .eq('submission_status', 'pending_review')
    .order('created_at', { ascending: true })

  const submissions = ((data ?? []) as SubmissionRow[]).map((row) => {
    const owner = Array.isArray(row.users) ? row.users[0] : row.users
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      status: row.status ?? 'Idea',
      created_at: row.created_at,
      owner_name: owner?.name ?? owner?.email ?? 'Unknown',
      owner_email: owner?.email ?? null,
      skills_needed: row.skills_needed ?? [],
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Idea Submissions</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Review pending ideas, then approve to publish on Discover or reject to keep private.
        </p>
      </div>
      <SubmissionsQueuePanel submissions={submissions} />
    </div>
  )
}
