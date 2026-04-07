import 'server-only'

interface CreateIssueInput {
  summary: string
  description?: string
  projectKey: string
  issueType?: string
  /**
   * Jira Epic issue key to link this issue to (e.g. "OC-5").
   * Linked via the `parent` field, which works for both team-managed (next-gen)
   * and modern company-managed (classic) projects. The legacy `customfield_10014`
   * Epic Link field was deprecated in Nov 2021 and is not used here.
   * If null/undefined, the issue is created without an Epic link.
   */
  epicKey?: string
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
  epicKey,
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

  const trimmedEpicKey = epicKey?.trim()
  if (trimmedEpicKey) {
    fields.parent = { key: trimmedEpicKey }
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

/**
 * Creates a Jira Epic in the configured project (JIRA_PROJECT_KEY) and returns
 * the new Epic's issue key (e.g. "OC-5").
 *
 * Both `summary` and `customfield_10011` (Epic Name) are set to epicName to
 * support classic/company-managed Scrum projects that still require the custom
 * field on their create screen. Team-managed projects ignore the custom field.
 */
export async function createEpic(epicName: string): Promise<string> {
  const baseUrl = normalizeBaseUrl(getRequiredEnv('JIRA_BASE_URL'))
  const email = getRequiredEnv('JIRA_EMAIL')
  const apiToken = getRequiredEnv('JIRA_API_TOKEN')

  const projectKey = process.env.JIRA_PROJECT_KEY?.trim()
  if (!projectKey) {
    throw new Error('JIRA_PROJECT_KEY is not configured')
  }

  const trimmedName = epicName.trim()
  if (!trimmedName) {
    throw new Error('Epic name is required')
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64')

  const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        issuetype: { name: 'Epic' },
        summary: trimmedName,
        // customfield_10011 is the "Epic Name" field required by some classic
        // Scrum projects. Set it to the same value as summary for compatibility.
        customfield_10011: trimmedName,
      },
    }),
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
    throw new Error(`Jira create epic failed (${response.status}): ${details}`)
  }

  const payload = (await response.json()) as { key?: string }
  if (!payload.key || typeof payload.key !== 'string') {
    throw new Error('Jira response did not include an issue key')
  }

  return payload.key
}
