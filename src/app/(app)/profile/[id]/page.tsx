import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProfileCard } from '@/components/profile/ProfileCard'
import type { ProjectSummary, ProjectStatus } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const [{ data: profile }, { data: skills }, { data: memberships }] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).single(),
    supabase.from('user_skills').select('skill').eq('user_id', id),
    supabase.from('project_members').select('project_id, role, projects(id, title, status, brand)').eq('user_id', id),
  ])

  if (!profile) notFound()

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

  return (
    <div className="max-w-2xl">
      <ProfileCard
        id={profile.id}
        name={profile.name}
        title={profile.title ?? ''}
        brand={profile.brand ?? ''}
        profilePhotoUrl={profile.profile_photo_url ?? undefined}
        linkedinUrl={profile.linkedin_url ?? ''}
        githubUsername={profile.github_username ?? undefined}
        skills={(skills ?? []).map((s: { skill: string }) => s.skill)}
        projects={projects}
        voteCount={0}
        activityScore={0}
        badges={[]}
        coworkSyncedAt={profile.cowork_synced_at ?? undefined}
      />
    </div>
  )
}
