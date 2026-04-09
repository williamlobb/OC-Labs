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

export type JiraErrorCode = 'PARENT_LINK_CONFLICT' | 'UNKNOWN'

export class JiraRequestError extends Error {
  readonly status: number
  readonly details: string
  readonly jiraErrorCode: JiraErrorCode

  constructor(prefix: string, status: number, details: string, jiraErrorCode: JiraErrorCode = 'UNKNOWN') {
    super(`${prefix} (${status}): ${details}`)
    this.name = 'JiraRequestError'
    this.status = status
    this.details = details
    this.jiraErrorCode = jiraErrorCode
  }
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

function parseJiraError(payload: unknown): { details: string | null; errorFields: string[] } {
  if (!payload || typeof payload !== 'object') {
    return { details: null, errorFields: [] }
  }

  const jiraError = payload as JiraErrorPayload
  if (Array.isArray(jiraError.errorMessages) && jiraError.errorMessages.length > 0) {
    return { details: jiraError.errorMessages.join('; '), errorFields: [] }
  }

  if (jiraError.errors && typeof jiraError.errors === 'object') {
    const errorFields = Object.keys(jiraError.errors)
    const details = Object.entries(jiraError.errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join('; ')
    if (details) return { details, errorFields }
  }

  return { details: null, errorFields: [] }
}

function isFieldConfigurationError(details: string, fieldId?: string): boolean {
  const lower = details.toLowerCase()
  const normalizedFieldId = fieldId?.toLowerCase()
  return (
    Boolean(normalizedFieldId && lower.includes(normalizedFieldId))
    || lower.includes('cannot be set')
    || lower.includes('not on the appropriate screen')
    || lower.includes('unknown field')
    || lower.includes('field does not exist')
  )
}

function getAuthHeader(email: string, apiToken: string): string {
  return Buffer.from(`${email}:${apiToken}`).toString('base64')
}

function isParentLinkConflict(details: string, errorFields: string[]): boolean {
  const lower = details.toLowerCase()
  const fieldSet = new Set(errorFields.map((field) => field.toLowerCase()))

  if (fieldSet.has('parent')) return true

  return (
    lower.includes('parent')
    && (
      lower.includes('issue type')
      || lower.includes('hierarchy')
      || lower.includes('epic')
      || lower.includes('cannot be set')
      || lower.includes('sub-task')
      || lower.includes('subtask')
      || lower.includes('not a valid parent')
      || lower.includes('child issue')
    )
  )
}

async function postIssue(
  baseUrl: string,
  auth: string,
  fields: Record<string, unknown>,
  errorPrefix: string
): Promise<string> {
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
    let errorFields: string[] = []
    try {
      const payload = await response.json()
      const parsed = parseJiraError(payload)
      details = parsed.details ?? details
      errorFields = parsed.errorFields
    } catch {
      // Keep fallback status text when payload is not JSON.
    }
    const jiraErrorCode = isParentLinkConflict(details, errorFields)
      ? 'PARENT_LINK_CONFLICT'
      : 'UNKNOWN'
    throw new JiraRequestError(errorPrefix, response.status, details, jiraErrorCode)
  }

  const payload = (await response.json()) as { key?: string }
  if (!payload.key || typeof payload.key !== 'string') {
    throw new Error('Jira response did not include an issue key')
  }

  return payload.key
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
  const auth = getAuthHeader(email, apiToken)

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

  const key = await postIssue(baseUrl, auth, fields, 'Jira request failed')

  return {
    key,
    url: `${baseUrl}/browse/${key}`,
  }
}

/**
 * Creates a Jira Epic in the configured project (JIRA_PROJECT_KEY) and returns
 * the new Epic's issue key (e.g. "OC-5").
 *
 * Uses a minimal payload by default (`project`, `issuetype`, `summary`) for
 * broad compatibility across Jira project configurations.
 *
 * If JIRA_EPIC_NAME_FIELD_ID is set (for example customfield_10011), it is
 * included as an optional field on the first attempt. If Jira returns a known
 * field/screen mismatch (HTTP 400), we retry once without optional fields.
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

  const auth = getAuthHeader(email, apiToken)
  const optionalEpicNameFieldId = process.env.JIRA_EPIC_NAME_FIELD_ID?.trim()

  const baseFields: Record<string, unknown> = {
    project: { key: projectKey },
    issuetype: { name: 'Epic' },
    summary: trimmedName,
  }

  const firstAttemptFields: Record<string, unknown> = { ...baseFields }
  if (optionalEpicNameFieldId) {
    firstAttemptFields[optionalEpicNameFieldId] = trimmedName
  }

  try {
    return await postIssue(baseUrl, auth, firstAttemptFields, 'Jira create epic failed')
  } catch (error) {
    if (
      optionalEpicNameFieldId
      && error instanceof JiraRequestError
      && error.status === 400
      && isFieldConfigurationError(error.details, optionalEpicNameFieldId)
    ) {
      return postIssue(baseUrl, auth, baseFields, 'Jira create epic failed')
    }
    throw error
  }
}
