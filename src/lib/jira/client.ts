import 'server-only'

interface CreateIssueInput {
  summary: string
  description?: string
  projectKey: string
  issueType?: string
}

interface JiraIssue {
  key: string
  url: string
}

interface JiraErrorPayload {
  errorMessages?: string[]
  errors?: Record<string, string>
}

function getRequiredEnv(name: 'JIRA_BASE_URL' | 'JIRA_EMAIL' | 'JIRA_API_TOKEN'): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function toAtlassianDocument(text: string): Record<string, unknown> {
  const paragraphs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    }))

  return {
    type: 'doc',
    version: 1,
    content: paragraphs.length > 0
      ? paragraphs
      : [{ type: 'paragraph', content: [{ type: 'text', text: 'Synced from OC Labs task.' }] }],
  }
}

function parseJiraError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null

  const jiraError = payload as JiraErrorPayload
  if (Array.isArray(jiraError.errorMessages) && jiraError.errorMessages.length > 0) {
    return jiraError.errorMessages.join('; ')
  }

  if (jiraError.errors && typeof jiraError.errors === 'object') {
    const details = Object.entries(jiraError.errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join('; ')
    if (details) return details
  }

  return null
}

export async function createIssue({
  summary,
  description,
  projectKey,
  issueType,
}: CreateIssueInput): Promise<JiraIssue> {
  const baseUrl = normalizeBaseUrl(getRequiredEnv('JIRA_BASE_URL'))
  const email = getRequiredEnv('JIRA_EMAIL')
  const apiToken = getRequiredEnv('JIRA_API_TOKEN')

  const trimmedSummary = summary.trim()
  if (!trimmedSummary) {
    throw new Error('Jira issue summary is required')
  }

  const trimmedProjectKey = projectKey.trim()
  if (!trimmedProjectKey) {
    throw new Error('Jira project key is required')
  }

  const resolvedIssueType = issueType?.trim() || 'Task'
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64')

  const fields: Record<string, unknown> = {
    project: { key: trimmedProjectKey },
    issuetype: { name: resolvedIssueType },
    summary: trimmedSummary,
  }

  if (description?.trim()) {
    fields.description = toAtlassianDocument(description.trim())
  }

  const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
    cache: 'no-store',
  })

  if (!response.ok) {
    let details = response.statusText || 'Request failed'
    try {
      const payload = await response.json()
      details = parseJiraError(payload) ?? details
    } catch {
      // Keep fallback status text when payload is not JSON.
    }
    throw new Error(`Jira request failed (${response.status}): ${details}`)
  }

  const payload = (await response.json()) as { key?: string }
  if (!payload.key || typeof payload.key !== 'string') {
    throw new Error('Jira response did not include an issue key')
  }

  return {
    key: payload.key,
    url: `${baseUrl}/browse/${payload.key}`,
  }
}
