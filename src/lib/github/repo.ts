// src/lib/github/repo.ts

export interface RepoMetadata {
  name: string
  description: string | null
  url: string
  stars: number
  language: string | null
  updatedAt: string
  readmePreview: string | null
}

export async function fetchRepoMetadata(repoUrl: string): Promise<RepoMetadata | null> {
  // Extract owner/repo from URL e.g. https://github.com/org/repo
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return null

  const [, owner, repo] = match

  try {
    const authHeader = process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}

    const [repoRes, readmeRes] = await Promise.allSettled([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: authHeader,
        next: { revalidate: 3600 },
      }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers: {
          Accept: 'application/vnd.github.raw',
          ...authHeader,
        },
        next: { revalidate: 3600 },
      }),
    ])

    if (repoRes.status === 'rejected' || !repoRes.value.ok) return null

    const repoData = await repoRes.value.json()
    let readmePreview: string | null = null

    if (readmeRes.status === 'fulfilled' && readmeRes.value.ok) {
      const text = await readmeRes.value.text()
      readmePreview = text.slice(0, 500)
    }

    return {
      name: repoData.name,
      description: repoData.description,
      url: repoData.html_url,
      stars: repoData.stargazers_count,
      language: repoData.language,
      updatedAt: repoData.updated_at,
      readmePreview,
    }
  } catch {
    return null
  }
}
