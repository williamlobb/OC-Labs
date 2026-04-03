import { fetchRepoMetadata } from '@/lib/github/repo'

interface RepoPreviewProps {
  repoUrl: string
}

export async function RepoPreview({ repoUrl }: RepoPreviewProps) {
  const meta = await fetchRepoMetadata(repoUrl)

  if (!meta) {
    return (
      <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-700">
        Repository info unavailable.
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
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          {meta.name}
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
      {meta.readmePreview && (
        <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 whitespace-pre-wrap">
          {meta.readmePreview}
        </pre>
      )}
    </div>
  )
}
