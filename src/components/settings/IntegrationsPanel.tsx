'use client'

import { cn } from '@/lib/utils/cn'

interface Integration {
  key: string
  name: string
  description: string
}

const INTEGRATIONS: Integration[] = [
  {
    key: 'jira',
    name: 'Jira',
    description: 'Sync project tasks to Jira epics and issues.',
  },
  {
    key: 'github',
    name: 'GitHub',
    description: 'Link repositories and surface live repo data on projects.',
  },
  {
    key: 'risk',
    name: 'AI Risk Navigator',
    description: 'Submit projects for AI-powered compliance and risk assessment. Available on project pages once configured.',
  },
]

function StatusPill({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        configured
          ? 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-400'
          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          configured ? 'bg-green-500' : 'bg-zinc-400 dark:bg-zinc-500'
        )}
      />
      {configured ? 'Connected' : 'Not configured'}
    </span>
  )
}

interface Props {
  jiraConfigured: boolean
  githubConfigured: boolean
}

export function IntegrationsPanel({ jiraConfigured, githubConfigured }: Props) {
  const statusMap: Record<string, boolean> = {
    jira: jiraConfigured,
    github: githubConfigured,
    risk: false,
  }

  return (
    <div className="space-y-3">
      {INTEGRATIONS.map((integration) => (
        <div
          key={integration.key}
          className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {integration.name}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {integration.description}
            </p>
          </div>
          <div className="shrink-0">
            <StatusPill configured={statusMap[integration.key]} />
          </div>
        </div>
      ))}
    </div>
  )
}
