'use client'

import { cn } from '@/lib/utils/cn'

// --- Logos ---

function JiraLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="jira-a" x1="16.265" y1="16.399" x2="8.311" y2="24.353" gradientUnits="userSpaceOnUse">
          <stop offset="0.176" stopColor="#0052CC" />
          <stop offset="1" stopColor="#2684FF" />
        </linearGradient>
        <linearGradient id="jira-b" x1="15.694" y1="15.845" x2="23.717" y2="7.822" gradientUnits="userSpaceOnUse">
          <stop offset="0.176" stopColor="#0052CC" />
          <stop offset="1" stopColor="#2684FF" />
        </linearGradient>
      </defs>
      <path
        d="M15.976 2.024C12.56 5.44 12.56 10.979 15.976 14.395l6.029 6.03 6.03-6.03C31.451 10.98 31.451 5.44 28.035 2.024L15.976 2.024z"
        fill="url(#jira-b)"
      />
      <path
        d="M15.976 17.605C12.56 14.189 7.021 14.189 3.605 17.605l-0 0 6.03 6.03c3.415 3.415 8.955 3.415 12.37 0l6.03-6.03c-3.415-3.415-8.644-3.415-12.059 0z"
        fill="url(#jira-a)"
      />
    </svg>
  )
}

function GitHubLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 2C8.268 2 2 8.268 2 16c0 6.197 4.02 11.454 9.594 13.306.7.13.956-.304.956-.674 0-.332-.012-1.213-.019-2.38-3.894.847-4.716-1.876-4.716-1.876-.636-1.617-1.554-2.047-1.554-2.047-1.271-.869.096-.852.096-.852 1.404.099 2.143 1.441 2.143 1.441 1.25 2.14 3.278 1.522 4.077 1.163.127-.904.489-1.522.888-1.871-3.109-.354-6.378-1.554-6.378-6.918 0-1.527.547-2.777 1.441-3.757-.145-.353-.624-1.777.136-3.705 0 0 1.174-.376 3.848 1.434A13.41 13.41 0 0 1 16 9.626c1.19.005 2.387.16 3.507.47 2.67-1.81 3.843-1.434 3.843-1.434.762 1.928.283 3.352.138 3.705.896.98 1.439 2.23 1.439 3.757 0 5.376-3.274 6.56-6.394 6.908.503.433.951 1.288.951 2.596 0 1.875-.017 3.383-.017 3.843 0 .373.252.81.96.673C25.983 27.451 30 22.196 30 16c0-7.732-6.268-14-14-14z"
      />
    </svg>
  )
}

function AIRiskLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2" />
      <path d="M16 9v7l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </svg>
  )
}

// --- Toggle ---

function Toggle({ enabled, disabled }: { enabled: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      title={disabled ? 'Configure environment variables to enable' : undefined}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400',
        enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          enabled && 'translate-x-[18px]'
        )}
      />
    </button>
  )
}

// --- Status pill ---

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

// --- Metadata row ---

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-zinc-400 dark:text-zinc-500">{label}</span>
      <span className="text-zinc-600 dark:text-zinc-300">{children}</span>
    </div>
  )
}

// --- Relative time helper ---

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// --- Props ---

interface Props {
  jiraConfigured: boolean
  jiraBaseUrl: string | null
  jiraProjectKey: string | null
  jiraLastSync: string | null
  githubConfigured: boolean
  githubOrg: string | null
}

// --- Cards ---

function JiraCard({ configured, baseUrl, projectKey, lastSync }: {
  configured: boolean
  baseUrl: string | null
  projectKey: string | null
  lastSync: string | null
}) {
  const spaceUrl = baseUrl && projectKey
    ? `${baseUrl}/jira/software/projects/${projectKey}/boards`
    : null
  const normalizedIssueType = 'Task (enforced)'

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F0FE]">
            <JiraLogo className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Jira</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Sync project tasks to Jira epics and issues.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusPill configured={configured} />
          <Toggle enabled={configured} disabled={!configured} />
        </div>
      </div>

      {configured && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3 space-y-2 bg-zinc-50/50 dark:bg-zinc-800/30">
          {projectKey && (
            <MetaRow label="Project key">{projectKey}</MetaRow>
          )}
          <MetaRow label="Issue type">{normalizedIssueType}</MetaRow>
          {lastSync ? (
            <MetaRow label="Last sync">{relativeTime(lastSync)}</MetaRow>
          ) : (
            <MetaRow label="Last sync">No tasks synced yet</MetaRow>
          )}
          {baseUrl && (
            <MetaRow label="Instance">
              <a
                href={baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate max-w-[260px] text-blue-600 hover:underline dark:text-blue-400"
              >
                {baseUrl.replace(/^https?:\/\//, '')}
              </a>
            </MetaRow>
          )}
          {spaceUrl && (
            <div className="pt-1">
              <a
                href={spaceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Open OC Labs space
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 10 10 2M5 2h5v5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GitHubCard({ configured, org }: { configured: boolean; org: string | null }) {
  const orgUrl = org ? `https://github.com/${org}` : null

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <GitHubLogo className="h-5 w-5 text-zinc-800 dark:text-zinc-100" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">GitHub</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Link repositories and surface live repo data on projects.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusPill configured={configured} />
          <Toggle enabled={configured} disabled={!configured} />
        </div>
      </div>

      {configured && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3 space-y-2 bg-zinc-50/50 dark:bg-zinc-800/30">
          <MetaRow label="Auth type">Personal access token</MetaRow>
          {org ? (
            <MetaRow label="Organisation">{org}</MetaRow>
          ) : (
            <MetaRow label="Organisation">Omnia Collective</MetaRow>
          )}
          <MetaRow label="API limit">5,000 req / hr</MetaRow>
          {orgUrl && (
            <div className="pt-1">
              <a
                href={orgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                View organisation on GitHub
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 10 10 2M5 2h5v5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AIRiskCard() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40">
            <AIRiskLogo className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Risk Navigator</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Submit projects for AI-powered compliance and risk assessment. Available on project pages once configured.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusPill configured={false} />
          <Toggle enabled={false} disabled />
        </div>
      </div>
    </div>
  )
}

// --- Main export ---

export function IntegrationsPanel({
  jiraConfigured,
  jiraBaseUrl,
  jiraProjectKey,
  jiraLastSync,
  githubConfigured,
  githubOrg,
}: Props) {
  return (
    <div className="space-y-3">
      <JiraCard
        configured={jiraConfigured}
        baseUrl={jiraBaseUrl}
        projectKey=https://omniacollective.atlassian.net/jira/software/projects/OCL/boards/133/timeline
        lastSync={jiraLastSync}
      />
      <GitHubCard configured={githubConfigured} org={githubOrg} />
      <AIRiskCard />
    </div>
  )
}
