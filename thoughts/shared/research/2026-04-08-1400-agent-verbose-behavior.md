# Research: Agent Verbose Behavior Root Cause
**Date**: 2026-04-08 14:00
**Scope**: agent/main.go, agent/agent.go, agent/tools_project.go, agent/tools_write.go, src/app/api/v1/projects/[id]/chat/route.ts, src/components/chat/ProjectChatPanel.tsx

## Key Findings

1. **Root cause — tool description directive**: `get_project_context` in `agent/tools_project.go:13` has the description: _"Always call this first before answering questions or making changes."_ The system prompt at `main.go:45` echoes this with "Use your tools to read project state before acting." Together these are a double mandate: the agent calls `get_project_context` for **every** message, including "hello", then dumps the full context blocks JSON as a summary.

2. **System prompt is sound, tool description is the trigger**: The system prompt itself is minimal and well-behaved (brief, no filler, wait for confirmation). The bug is not in the personality rules — it's the `get_project_context` description overriding them by directing eager fetching.

3. **Context is NOT injected from the frontend**: The chat route does not pre-populate history with CLAUDE.md, context blocks, or any primer. Fresh chat starts with `history: []`. Context only enters via the agent's tool call.

4. **`github_tools` and `task_tools` are silently dropped**: `route.ts:139-140` sends these fields to the agent, but `ChatRequest` in `main.go:15-22` has no corresponding struct fields — Go's JSON decoder ignores unknown keys. Dead payload.

5. **Task-creation prompt is a side-effect of verbose context read**: After calling `get_project_context`, the agent has read all context blocks (which contain CLAUDE.md summaries, architecture notes, etc.). It then synthesises a summary and — following its "check tasks before creating duplicates" instruction — asks if the user wants tasks created. This is emergent behavior from the data, not a hard-coded path.

6. **`get_project_context` returns raw JSON**: The tool at `tools_project.go:44` returns the raw JSON response string. The model then has to interpret and summarise it, which produces verbose output.

7. **The blog reference is correct**: https://ampcode.com/notes/how-to-build-an-agent shows a minimal loop — tool descriptions should be narrow and reactive, not directive. The issue is the imperative "Always call this first."

## Relevant Files

- `agent/main.go:13,29-45` — ChatRequest struct (missing github_tools/task_tools fields); system prompt
- `agent/tools_project.go:13` — `get_project_context` description with "Always call this first" directive
- `agent/tools_project.go:50` — `get_tasks` description (fine as-is)
- `agent/agent.go:30-88` — agentic loop; no guardrails on when tools are called
- `src/app/api/v1/projects/[id]/chat/route.ts:139-141` — dead `github_tools`/`task_tools` payload sent but never parsed by agent

## Patterns Observed

- Tool descriptions written as imperatives ("Always call this first") act as unconditional triggers — the model treats them as instructions, not hints
- System prompt brevity directives lose to tool-level imperative descriptions
- Raw JSON tool returns invite model summarisation/interpretation → verbose output

## Recommendations

### Fix 1 (critical): Rewrite `get_project_context` description — remove imperative
```
// BEFORE
"Read the project's full context including title, summary, status, team members, and all context blocks. Always call this first before answering questions or making changes."

// AFTER
"Read the project's context (title, summary, status, team members, context blocks). Call this when the user asks about the project, its status, or its configuration — not on every message."
```

### Fix 2 (critical): Remove "Use your tools to read project state before acting" from system prompt
Replace with: "Only fetch project data when the user's request requires it."

### Fix 3 (nice-to-have): Add `GithubTools`/`TaskTools` fields to `ChatRequest` struct, or remove the dead payload from `route.ts`

### Fix 4 (nice-to-have): Consider returning structured fields from `get_project_context` instead of raw JSON, so the model has less to interpret/summarise

## Status of Agent Fixes (verified 2026-04-08)

Both critical agent-side fixes are **already applied** in the codebase:

- `tools_project.go:13` — description now reads: _"Call this when the user asks about the project…not on every message."_ ✓
- `main.go:66` (system prompt) — now reads: _"Only fetch project data when the user's request requires it."_ ✓

---

## React Rendering Gap (new findings)

### Current rendering — `src/components/chat/ProjectChat.tsx:134`
```tsx
{msg.content || <span className="animate-pulse …" />}
```
Raw string, no markdown parsing. Agent output of `**bold**`, `## heading`, `` `code` ``, and bullet lists all renders as literal characters — the wall-of-text problem in the screenshot.

### No markdown library installed
`package.json` has no `react-markdown`, `marked`, `remark`, or any equivalent. Adding one is required.

### Streaming architecture
The current Go agent (`agent.go:73-78`) uses non-streaming `client.Messages.New` and writes the full text once at the end with `io.WriteString(w, lastText)`. The React component receives this as a single chunk and displays it at once — there is no true token-level progressive reveal. The chunked transfer encoding only matters when the Go agent calls tools in multiple turns (each `io.WriteString` call would be a separate chunk, but the final text is one call).

---

## React Streaming Patterns (research)

Modern chat UIs (Vercel AI SDK, ChatGPT, etc.) use:
1. **SSE or chunked text streaming** — server pushes tokens one-by-one; already wired in the route handler
2. **Markdown rendered on each update** — re-parse the accumulated string every state tick; acceptable for responses under ~10K chars
3. **Code block syntax highlighting** — via `rehype-highlight` or `rehype-prism` plugins for `react-markdown`
4. **Progressive reveal via cursor** — show a blinking cursor appended to the last streamed chunk

For OC Labs the minimum viable improvement is step 2 (markdown rendering). Steps 1/3/4 are nice-to-have.

---

## Implementation Path — minimal changes for readable output

### Step 1 — Install `react-markdown` (single dependency)
```bash
npm install react-markdown
```
`react-markdown` renders markdown safely by default (no `dangerouslySetInnerHTML`). It supports GFM (tables, task lists, strikethrough) via the optional `remark-gfm` plugin.

### Step 2 — Render assistant messages through ReactMarkdown (`ProjectChat.tsx`)
```tsx
import ReactMarkdown from 'react-markdown'

// In the message bubble, replace:
{msg.content || <span className="animate-pulse …" />}

// With:
{msg.role === 'assistant' && msg.content ? (
  <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
    {msg.content}
  </ReactMarkdown>
) : (
  msg.content || <span className="animate-pulse …" />
)}
```

### Step 3 — Add prose Tailwind plugin (optional but clean)
`@tailwindcss/typography` gives `prose` classes that style headings, lists, code blocks automatically. Without it, just add utility classes manually (`[&_h2]:font-bold [&_ul]:list-disc` etc.).

### Step 4 (optional) — True token streaming in Go agent
Replace `client.Messages.New` in the final response turn with `client.Messages.NewStreaming`, writing each text delta to `w` as it arrives. This would give word-by-word appearance instead of a single block render. Lower priority — readability is the blocking issue, not streaming latency.

---

## Open Questions

- Should `get_project_context` be called automatically on the first message of a *new* session only? Middle ground if verbosity returns.
- After adding markdown rendering, verify the streaming pulse indicator still shows before the first chunk arrives (the `animate-pulse` span guards on `msg.content` being empty — this is already correct).

## Raw Agent Outputs

See explorers above (omitted for brevity — all findings synthesised into Key Findings).
