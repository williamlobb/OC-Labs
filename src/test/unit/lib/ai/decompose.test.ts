/**
 * Unit tests for src/lib/ai/decompose.ts
 *
 * Covers the LLM output validation fix (#9): malformed items returned by the
 * model must be filtered out before rows are inserted into the DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- mocks ----------------------------------------------------------------

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

// ---- module under test ----------------------------------------------------
import { decomposeProject } from '@/lib/ai/decompose'

// ---- helpers ---------------------------------------------------------------

function makeResponse(text: string) {
  return { content: [{ type: 'text', text }] }
}

// ---- tests -----------------------------------------------------------------

describe('decomposeProject — LLM output validation', () => {
  beforeEach(() => { mockCreate.mockReset() })

  it('returns valid tasks when the model returns a well-formed array', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify([
      {
        title: 'Set up DB',
        body: 'Create schema.',
        status: 'todo',
        assigned_to_agent: false,
        depends_on_indices: [],
      },
      {
        title: 'Write tests',
        body: 'Add unit tests.',
        status: 'todo',
        assigned_to_agent: true,
        depends_on_indices: [0],
      },
    ])))

    const result = await decomposeProject('My Project', 'A summary', [])
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Set up DB')
    expect(result[1].assigned_to_agent).toBe(true)
    expect(result[1].depends_on_indices).toEqual([0])
  })

  it('filters out items missing required fields', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify([
      { title: 'Valid task', body: 'Does something.', status: 'todo', assigned_to_agent: false },
      { title: 'Missing body', status: 'todo', assigned_to_agent: false },
      { body: 'Missing title', status: 'todo', assigned_to_agent: false },
      { title: '', body: 'Empty title', status: 'todo', assigned_to_agent: false },
    ])))

    const result = await decomposeProject('My Project', 'A summary', [])
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Valid task')
  })

  it('filters out items with wrong status value', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify([
      { title: 'Good', body: 'Fine.', status: 'todo', assigned_to_agent: false },
      { title: 'Bad status', body: 'Oops.', status: 'done', assigned_to_agent: false },
    ])))

    const result = await decomposeProject('My Project', 'A summary', [])
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Good')
  })

  it('filters out items where assigned_to_agent is not a boolean', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify([
      { title: 'Good', body: 'Fine.', status: 'todo', assigned_to_agent: false },
      { title: 'Bad flag', body: 'Oops.', status: 'todo', assigned_to_agent: 'yes' },
      { title: 'Null flag', body: 'Oops.', status: 'todo', assigned_to_agent: null },
    ])))

    const result = await decomposeProject('My Project', 'A summary', [])
    expect(result).toHaveLength(1)
  })

  it('normalizes duplicate depends_on_indices values', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify([
      {
        title: 'Good',
        body: 'Fine.',
        status: 'todo',
        assigned_to_agent: false,
        depends_on_indices: [0, 1, 1, 2, 2],
      },
    ])))

    const result = await decomposeProject('My Project', 'A summary', [])
    expect(result).toHaveLength(1)
    expect(result[0].depends_on_indices).toEqual([0, 1, 2])
  })

  it('filters out items with invalid depends_on_indices', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify([
      {
        title: 'Valid',
        body: 'Fine.',
        status: 'todo',
        assigned_to_agent: false,
        depends_on_indices: [0],
      },
      {
        title: 'Bad',
        body: 'Invalid dependency values.',
        status: 'todo',
        assigned_to_agent: false,
        depends_on_indices: ['1'],
      },
    ])))

    const result = await decomposeProject('My Project', 'A summary', [])
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Valid')
  })

  it('returns empty array when model returns a non-array', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify({ tasks: [] })))
    expect(await decomposeProject('My Project', 'A summary', [])).toEqual([])
  })

  it('returns empty array when model returns invalid JSON', async () => {
    mockCreate.mockResolvedValue(makeResponse('not json at all'))
    expect(await decomposeProject('My Project', 'A summary', [])).toEqual([])
  })

  it('returns empty array when model returns an empty array', async () => {
    mockCreate.mockResolvedValue(makeResponse('[]'))
    expect(await decomposeProject('My Project', 'A summary', [])).toEqual([])
  })
})
