import { extractGitHubRepoRef, fetchRepoMetadata } from '@/lib/github/repo'

interface RepoPreviewProps {
  repoUrl: string
}

function GitHubIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5 text-zinc-500"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

export async function RepoPreview({ repoUrl }: RepoPreviewProps) {
  const meta = await fetchRepoMetadata(repoUrl)
  const ref = extractGitHubRepoRef(repoUrl)
  const fallbackLabel = ref?.fullName ?? repoUrl

  if (!meta) {
    return (
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          <GitHubIcon />
          {fallbackLabel}
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 space-y-2 dark:border-zinc-700">
      <div className="flex items-start justify-between gap-2">
        <a
          href={meta.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          <GitHubIcon />
          {meta.fullName || meta.name}
        </a>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <span>★ {meta.stars}</span>
          {meta.language && <span>· {meta.language}</span>}
        </div>
      </div>
      {meta.description && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{meta.description}</p>
      )}
      <p className="text-xs text-zinc-400">
        Updated {new Date(meta.updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </div>
  )
}
