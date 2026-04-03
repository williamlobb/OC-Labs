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
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{project.title}</h1>
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

      <div className="flex flex-wrap gap-4">
        {project.github_repos.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        ))}
        {(project as Project & { notion_url?: string }).notion_url && (
          <a
            href={(project as Project & { notion_url?: string }).notion_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Notion →
          </a>
        )}
      </div>
    </div>
  )
}
