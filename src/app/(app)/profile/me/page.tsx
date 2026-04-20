import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProfileCard } from '@/components/profile/ProfileCard'
import { EditProfileForm } from '@/components/profile/EditProfileForm'
import type { ProjectSummary, ProjectStatus } from '@/types'

export default async function MyProfilePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: skills }, { data: memberships }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('user_skills').select('skill').eq('user_id', user.id),
    supabase.from('project_members').select('project_id, role, projects(id, title, status, brand)').eq('user_id', user.id),
  ])

  if (!profile) redirect('/login')

  type ProjectRecord = { id: string; title: string; status: ProjectStatus; brand: string }
  type MembershipRow = {
    project_id: string
    role: string
    projects: ProjectRecord | ProjectRecord[] | null
  }

  const projects: ProjectSummary[] = (memberships ?? [])
    .map((m: MembershipRow) => {
      const p = Array.isArray(m.projects) ? m.projects[0] : m.projects
      return p ?? null
    })
    .filter((p): p is ProjectRecord => p !== null)

  const skillList = (skills ?? []).map((s: { skill: string }) => s.skill)

  return (
    <div className="max-w-2xl space-y-10">
      <ProfileCard
        id={profile.id}
        name={profile.name}
        title={profile.title ?? ''}
        brand={profile.brand ?? ''}
        profilePhotoUrl={profile.profile_photo_url ?? undefined}
        linkedinUrl={profile.linkedin_url ?? ''}
        githubUsername={profile.github_username ?? undefined}
        skills={skillList}
        projects={projects}
        voteCount={0}
        activityScore={0}
        badges={[]}
        coworkSyncedAt={profile.cowork_synced_at ?? undefined}
      />

      <section>
        <h2 className="font-heading mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Edit profile
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          Name, title, brand, and photo are managed by CoWork and cannot be edited here.
        </p>
        <EditProfileForm
          initialLinkedinUrl={profile.linkedin_url ?? ''}
          initialGithubUsername={profile.github_username ?? ''}
          initialSkills={skillList}
        />
      </section>
    </div>
  )
}
