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

export async function fetchRepoMetadata(repoUrl: string): Promise<RepoMetadata | null> {
  const ref = extractGitHubRepoRef(repoUrl)
  if (!ref) return null
  const { owner, repo, fullName } = ref

  try {
    const authHeader: Record<string, string> = process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}

    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: authHeader,
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
