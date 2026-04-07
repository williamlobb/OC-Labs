import { cn } from '@/lib/utils/cn'
import type { Project, ProjectStatus } from '@/types'

const STATUS_STYLES: Record<ProjectStatus, string> = {
  'Idea': 'bg-blue-100 text-blue-700',
  'In progress': 'bg-amber-100 text-amber-700',
  'Needs help': 'bg-red-100 text-red-700',
  'Paused': 'bg-zinc-100 text-zinc-500',
  'Shipped': 'bg-green-100 text-green-700',
}

interface ProjectHeaderProps {
  project: Project
  isOwner: boolean
}

export function ProjectHeader({ project, isOwner }: ProjectHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                STATUS_STYLES[project.status]
              )}
            >
              {project.status}
            </span>
            {project.brand && (
              <span className="text-sm text-zinc-500">{project.brand}</span>
            )}
          </div>
          <h1 className="font-heading text-3xl font-bold text-zinc-900 dark:text-zinc-50">{project.title}</h1>
        </div>
        {isOwner && (
          <a
            href={`/projects/${project.id}/edit`}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </a>
        )}
      </div>

      {project.summary && (
        <p className="text-base text-zinc-600 dark:text-zinc-400">{project.summary}</p>
      )}

      {project.skills_needed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {project.skills_needed.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {(project as Project & { notion_url?: string }).notion_url && (
        <div className="flex flex-wrap gap-4">
          <a
            href={(project as Project & { notion_url?: string }).notion_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Notion →
          </a>
        </div>
      )}
    </div>
  )
}
