import { avatarColor } from '@/lib/utils/avatar'
import type { MemberRole } from '@/types'

interface TeamMember {
  user_id: string
  name: string
  role: MemberRole
  profile_photo_url?: string | null
}

interface TeamListProps {
  members: TeamMember[]
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  contributor: 'Contributor',
  interested: 'Interested',
  observer: 'Observer',
  tech_lead: 'Tech Lead',
}

function getInitials(name: string): string {
  if (!name.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export function TeamList({ members }: TeamListProps) {
  if (members.length === 0) {
    return <p className="text-sm text-zinc-500">No team members yet.</p>
  }

  return (
    <ul className="space-y-3">
      {members.map((member) => {
        const color = avatarColor(member.user_id)
        return (
          <li key={member.user_id} className="flex items-center gap-3">
            {member.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.profile_photo_url}
                alt={member.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium"
                style={{ backgroundColor: color.bg, color: color.fg }}
              >
                {getInitials(member.name)}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{member.name}</p>
              <p className="text-xs text-zinc-500">{ROLE_LABELS[member.role]}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
