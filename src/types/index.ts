// src/types/index.ts

export type ProjectStatus = 'Idea' | 'In progress' | 'Needs help' | 'Paused' | 'Shipped'
export type MemberRole = 'owner' | 'contributor' | 'interested' | 'observer'

export interface AvatarColor {
  bg: string
  fg: string
}

export interface ProjectSummary {
  id: string
  title: string
  status: ProjectStatus
  brand: string
}

export interface User {
  id: string
  email: string
  name: string
  title?: string
  brand?: string
  profile_photo_url?: string
  linkedin_url?: string
  github_username?: string
  cowork_synced_at?: string
  created_at: string
}

export interface Project {
  id: string
  title: string
  summary?: string
  status: ProjectStatus
  brand?: string
  owner_id?: string
  github_repos: string[]
  skills_needed: string[]
  needs_help: boolean
  vote_count: number
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  project_id: string
  user_id: string
  role: MemberRole
  joined_at: string
}

export interface Vote {
  project_id: string
  user_id: string
  voted_at: string
}

export interface ProjectUpdate {
  id: string
  project_id: string
  author_id?: string
  body: string
  milestone: boolean
  posted_at: string
}

export interface UserSkill {
  user_id: string
  skill: string
  source: string
}

// Component prop interfaces

export interface ProjectCardProps {
  id: string
  title: string
  brand: string
  status: ProjectStatus
  desc: string
  skills: string[]
  owner: { id: string; name: string; avatarColor: AvatarColor }
  voteCount: number
  hasVoted: boolean
  hasJoined: boolean
  needsHelp: boolean
  onVote: () => void
  onJoin: () => void
  onClick: () => void
}

export interface ProfileCardProps {
  id: string
  name: string
  title: string
  brand: string
  profilePhotoUrl?: string
  linkedinUrl: string
  githubUsername?: string
  skills: string[]
  projects: ProjectSummary[]
  voteCount: number
  activityScore: number
  badges: string[]
}
