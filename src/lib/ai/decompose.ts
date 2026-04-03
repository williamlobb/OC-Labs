import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface DecomposedTask {
  title: string
  body: string
  status: 'todo'
  assigned_to_agent: boolean
}

interface ContextBlock {
  title: string
  body: string
  block_type: string
}

function isValidDecomposedTask(item: unknown): item is DecomposedTask {
  if (typeof item !== 'object' || item === null) return false
  const t = item as Record<string, unknown>
  return (
    typeof t.title === 'string' && t.title.trim().length > 0 &&
    typeof t.body === 'string' && t.body.trim().length > 0 &&
    t.status === 'todo' &&
    typeof t.assigned_to_agent === 'boolean'
  )
}

export async function decomposeProject(
  title: string,
  summary: string,
  contextBlocks: ContextBlock[]
): Promise<DecomposedTask[]> {
  const contextSection =
    contextBlocks.length > 0
      ? contextBlocks
          .map((b) => `[${b.block_type.toUpperCase()}] ${b.title}\n${b.body}`)
          .join('\n\n')
      : 'No additional context provided.'

  const prompt = `You are a project planning assistant. Break down the following project into concrete, actionable tasks.

Project: ${title}
Summary: ${summary || 'No summary provided.'}

Context:
${contextSection}

Return a JSON array of tasks. Each task must have:
- title: short, action-oriented (max 80 chars)
- body: 1-2 sentence description of what needs to be done
- status: always "todo"
- assigned_to_agent: true if this task is best suited for an AI agent (code generation, research, documentation), false for human tasks

Return ONLY valid JSON, no markdown, no explanation. Example:
[{"title":"Set up database schema","body":"Create tables and RLS policies for the core data model.","status":"todo","assigned_to_agent":false}]`

  try {
    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    // Validate each element has the required fields with the correct types before
    // inserting into the DB — malformed LLM output would otherwise cause constraint
    // violations or silently insert null values.
    return parsed.filter(isValidDecomposedTask)
  } catch {
    return []
  }
}
