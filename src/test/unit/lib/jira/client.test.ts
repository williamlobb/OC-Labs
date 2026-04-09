import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEpic } from '@/lib/jira/client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getPostedFields(calls: unknown[][], callIndex = 0): Record<string, unknown> {
  const call = calls[callIndex]
  if (!call) throw new Error(`Missing fetch call at index ${callIndex}`)
  const init = call[1] as RequestInit | undefined
  if (!init?.body || typeof init.body !== 'string') throw new Error('Missing JSON body')
  const parsed = JSON.parse(init.body) as { fields?: Record<string, unknown> }
  return parsed.fields ?? {}
}

describe('createEpic', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.JIRA_BASE_URL = 'https://jira.example.com'
    process.env.JIRA_EMAIL = 'jira@example.com'
    process.env.JIRA_API_TOKEN = 'token'
    process.env.JIRA_PROJECT_KEY = 'OC'
    delete process.env.JIRA_EPIC_NAME_FIELD_ID
  })

  it('uses minimal default payload without optional custom field', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      jsonResponse({ key: 'OC-1' }, 201)
    )

    await expect(createEpic('Platform Migration')).resolves.toBe('OC-1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const fields = getPostedFields(fetchMock.mock.calls)

    expect(fields).toMatchObject({
      project: { key: 'OC' },
      issuetype: { name: 'Epic' },
      summary: 'Platform Migration',
    })
    expect(fields).not.toHaveProperty('customfield_10011')
  })

  it('includes optional epic-name field only when configured', async () => {
    process.env.JIRA_EPIC_NAME_FIELD_ID = 'customfield_10011'
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      jsonResponse({ key: 'OC-2' }, 201)
    )

    await expect(createEpic('New Integrations')).resolves.toBe('OC-2')

    const fields = getPostedFields(fetchMock.mock.calls)
    expect(fields).toMatchObject({
      summary: 'New Integrations',
      customfield_10011: 'New Integrations',
    })
  })

  it('retries once without optional field on field-specific 400 errors', async () => {
    process.env.JIRA_EPIC_NAME_FIELD_ID = 'customfield_10011'
    const fetchMock = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          { errors: { customfield_10011: 'cannot be set. It is not on the appropriate screen.' } },
          400
        )
      )
      .mockResolvedValueOnce(jsonResponse({ key: 'OC-3' }, 201))

    await expect(createEpic('Q3 Workstream')).resolves.toBe('OC-3')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstFields = getPostedFields(fetchMock.mock.calls, 0)
    const secondFields = getPostedFields(fetchMock.mock.calls, 1)

    expect(firstFields).toHaveProperty('customfield_10011', 'Q3 Workstream')
    expect(secondFields).not.toHaveProperty('customfield_10011')
    expect(secondFields).toMatchObject({
      project: { key: 'OC' },
      issuetype: { name: 'Epic' },
      summary: 'Q3 Workstream',
    })
  })
})
