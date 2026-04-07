// src/lib/github/repo.ts

export interface RepoMetadata {
  name: string
  fullName: string
  description: string | null
  url: string
  stars: number
  language: string | null
  updatedAt: string
}

export interface GitHubRepoRef {
  owner: string
  repo: string
  fullName: string
}

export interface CommitSummary {
  sha: string
  message: string
  author: string
  date: string
  url: string
}

export interface DeploymentStatus {
  id: number
  environment: string
  state: string
  createdAt: string
  url: string | null
}

export interface FileTreeEntry {
  path: string
  type: 'blob' | 'tree'
  size?: number
}

function githubAuthHeader(): Record<string, string> {
  return process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}
}

export function extractGitHubRepoRef(repoUrl: string): GitHubRepoRef | null {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/i)
  if (!match) return null

  const owner = match[1]
  const repo = match[2].replace(/\.git$/i, '')
  if (!owner || !repo) return null

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
  }
}

/** Parse "owner/repo" shorthand or a full GitHub URL into a ref. */
export function parseRepoRef(value: string): GitHubRepoRef | null {
  if (value.includes('github.com')) return extractGitHubRepoRef(value)
  const parts = value.split('/')
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1], fullName: value }
  }
  return null
}

export async function fetchRepoMetadata(repoUrl: string): Promise<RepoMetadata | null> {
  const ref = extractGitHubRepoRef(repoUrl)
  if (!ref) return null
  const { owner, repo, fullName } = ref

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubAuthHeader(),
      next: { revalidate: 3600 },
    })

    if (!repoRes.ok) return null

    const repoData = await repoRes.json()

    return {
      name: repoData.name,
      fullName: repoData.full_name ?? fullName,
      description: repoData.description,
      url: repoData.html_url,
      stars: repoData.stargazers_count,
      language: repoData.language,
      updatedAt: repoData.updated_at,
    }
  } catch {
    return null
  }
}

export async function fetchReadme(owner: string, repo: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: {
        ...githubAuthHeader(),
        Accept: 'application/vnd.github.raw+json',
      },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

export async function fetchCommits(
  owner: string,
  repo: string,
  limit = 10,
): Promise<CommitSummary[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`,
      { headers: githubAuthHeader(), next: { revalidate: 60 } },
    )
    if (!res.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json()
    return data.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: (c.commit.message as string).split('\n')[0],
      author: c.commit.author?.name ?? c.author?.login ?? 'unknown',
      date: c.commit.author?.date ?? '',
      url: c.html_url,
    }))
  } catch {
    return []
  }
}

export async function fetchDeployments(
  owner: string,
  repo: string,
): Promise<DeploymentStatus[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/deployments?per_page=5`,
      { headers: githubAuthHeader(), next: { revalidate: 60 } },
    )
    if (!res.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deployments: any[] = await res.json()

    const statuses = await Promise.all(
      deployments.map(async (d) => {
        const statusRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/deployments/${d.id}/statuses?per_page=1`,
          { headers: githubAuthHeader(), next: { revalidate: 60 } },
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusData: any[] = statusRes.ok ? await statusRes.json() : []
        const latest = statusData[0]
        return {
          id: d.id as number,
          environment: d.environment as string,
          state: (latest?.state ?? 'unknown') as string,
          createdAt: d.created_at as string,
          url: (latest?.environment_url ?? null) as string | null,
        }
      }),
    )
    return statuses
  } catch {
    return []
  }
}

/**
 * Returns the recursive file tree for the default branch.
 * Capped at 500 entries to stay within response size limits.
 */
export async function fetchFileTree(
  owner: string,
  repo: string,
): Promise<FileTreeEntry[]> {
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubAuthHeader(),
      next: { revalidate: 3600 },
    })
    if (!repoRes.ok) return []
    const repoData = await repoRes.json()
    const branch: string = repoData.default_branch ?? 'main'

    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: githubAuthHeader(), next: { revalidate: 300 } },
    )
    if (!treeRes.ok) return []
    const treeData = await treeRes.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (treeData.tree as any[])
      .filter((e) => e.type === 'blob' || e.type === 'tree')
      .slice(0, 500)
      .map((e) => ({ path: e.path as string, type: e.type as 'blob' | 'tree', size: e.size as number | undefined }))
  } catch {
    return []
  }
}

/**
 * Fetches raw file content. Returns null if the file doesn't exist or is binary.
 * Capped at 500 KB to avoid blowing the context window.
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          ...githubAuthHeader(),
          Accept: 'application/vnd.github.raw+json',
        },
        next: { revalidate: 60 },
      },
    )
    if (!res.ok) return null
    const text = await res.text()
    // Guard: skip files larger than 500 KB
    if (text.length > 500_000) return '[File too large — fetch a smaller range]'
    return text
  } catch {
    return null
  }
}
