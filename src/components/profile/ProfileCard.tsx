import { avatarColor } from '@/lib/utils/avatar'
import { SkillChips } from './SkillChips'
import type { ProfileCardProps } from '@/types'

function getInitials(name: string): string {
  if (!name.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export function ProfileCard({
  id,
  name,
  title,
  brand,
  profilePhotoUrl,
  linkedinUrl,
  githubUsername,
  skills,
  projects,
  coworkSyncedAt,
}: ProfileCardProps & { coworkSyncedAt?: string }) {
  const color = avatarColor(id)

  return (
    <div className="space-y-6">
      {/* Avatar + identity */}
      <div className="flex items-start gap-4">
        {profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profilePhotoUrl}
            alt={name}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold"
            style={{ backgroundColor: color.bg, color: color.fg }}
          >
            {getInitials(name)}
          </div>
        )}
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{name}</h1>
          {title && <p className="text-sm text-zinc-600 dark:text-zinc-400">{title}</p>}
          {brand && <p className="text-xs text-zinc-500">{brand}</p>}
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-4">
        {linkedinUrl && (
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            LinkedIn →
          </a>
        )}
        {githubUsername && (
          <a
            href={`https://github.com/${githubUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            GitHub →
          </a>
        )}
      </div>

      {/* Skills */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Skills</h2>
        <SkillChips skills={skills} />
      </section>

      {/* Projects */}
      {projects.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Projects</h2>
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <a
                  href={`/projects/${p.id}`}
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {p.title}
                  <span className="ml-2 text-xs text-zinc-400">{p.brand}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CoWork sync status */}
      {coworkSyncedAt && (
        <p className="text-xs text-zinc-400">
          Profile synced from CoWork{' '}
          {new Date(coworkSyncedAt).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
