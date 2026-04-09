# Research: Real Streaming of Agent Tool Calling and Thinking
**Date**: 2026-04-09 07:47 AEST
**Scope**: End-to-end investigation of how OC Labs chat currently streams responses, where agent/tool progress exists internally, and what would be required to expose minimal real runtime state (not cosmetic placeholders).

## Key Findings
1. Both chat UIs currently show a pulsing dot only because assistant content starts as an empty string and there is no structured progress state to render.
2. Current client parsers consume raw text bytes and accumulate them into a single assistant `content` string; they do not parse typed stream events.
3. Project chat route is a byte-for-byte plain-text proxy to the Go agent (`text/plain`, chunked).
4. The Go agent has a real tool loop (`tool_use` -> execute tool -> `tool_result`) but only emits final assistant text at the end of iterations.
5. Because the Go agent uses non-streaming `Messages.New`, project chat cannot reveal token-level or phase-level progress today, even though transport is chunked.
6. Discover chat does use Anthropic streaming and can observe tool-related events internally, but currently forwards only text deltas to the client.
7. There is no existing SSE/WebSocket/EventSource contract in the app for chat progress events.
8. Introducing “real minimal progress” requires protocol changes (event framing) plus UI parsing/rendering changes; replacing the pulse dot alone would be cosmetic.

## Relevant Files
- `src/components/chat/ProjectChat.tsx` - client stream reader; current pulse-dot fallback and text accumulation behavior.
- `src/components/chat/DiscoverChat.tsx` - same pattern for discover assistant.
- `src/app/api/v1/projects/[id]/chat/route.ts` - project chat proxy; forwards upstream stream as plain text.
- `src/app/api/v1/discover/chat/route.ts` - discover chat stream producer; currently emits text only.
- `agent/main.go` - project agent HTTP stream endpoint.
- `agent/agent.go` - internal model/tool execution loop; writes final text only.
- `src/types/index.ts` - chat message shape is `content`-only (no progress metadata).
- `src/components/chat/ProjectChatPanel.tsx` - persisted chat message validator likely affected if message schema expands.

## Patterns Observed
- Existing pattern for incremental UX is a single placeholder assistant message that is progressively overwritten with accumulated stream text.
- Most client state is local `useState`; no shared realtime/event bus pattern exists yet.
- API error handling convention is usually `{ error: string }` JSON for non-stream paths.
- The app already relies on streamed responses for chat transport; the missing piece is structured event framing, not transport availability.

## Open Questions
- Should progress streaming be introduced for project chat only first, or both project + discover in one protocol?
- Preferred event framing: SSE (`text/event-stream`) vs NDJSON over chunked `text/plain`? (SSE improves debuggability and event typing.)
- How much “thinking” should be exposed: phase labels only, or concise intermediate reasoning summaries?
- Should event data be persisted anywhere (`project_chat_messages` currently unused) or remain ephemeral UI-only?
- Do we need API-key-compatible streaming behavior like updates endpoints support, or browser session auth only?

## Recommendations
1. Introduce a minimal typed stream contract for project chat first:
   - `run_started`
   - `phase`
   - `tool_started`
   - `tool_finished` (`ok`/`error`)
   - `text_delta`
   - `run_completed`
   - `run_failed`
2. Instrument `agent/agent.go` around each tool invocation and model turn to emit these events as they happen.
3. Update `src/app/api/v1/projects/[id]/chat/route.ts` to pass framed events through without collapsing to raw text.
4. Update `ProjectChat.tsx` to parse events and render a compact status rail (single line + last tool), while still streaming final assistant text.
5. Keep fallback compatibility: if payload is plain text (legacy mode), preserve current behavior.
6. After project chat stabilizes, apply same protocol to discover chat to avoid divergent client parsers.

## Raw Agent Outputs
### Explorer A (UI entry points)
**Key findings**
- Chat UIs use a generic pulsing-dot placeholder whenever the assistant message is empty during streaming:
  - [DiscoverChat pulse dot](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChat.tsx:176), with streaming state set in [DiscoverChat `streaming`](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChat.tsx:22) and assistant placeholder creation in [DiscoverChat insert empty assistant message](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChat.tsx:53).
  - [ProjectChat pulse dot](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx:170), with streaming state in [ProjectChat `streaming`](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx:34) and empty assistant message insertion in [ProjectChat insert empty assistant message](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx:58).
- Both chat clients treat stream data as plain text and append into `content` only (no status event parsing):
  - [DiscoverChat stream read loop](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChat.tsx:81)
  - [ProjectChat stream read loop](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx:93)
- Project chat backend is a plain-text pass-through proxy to `/agent/chat`:
  - [Project chat API fetch upstream agent](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts:72)
  - [Project chat API forwarding stream bytes](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts:111)
  - [Project chat API returns `text/plain`](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts:129)
- Discover chat API already has natural progress phases but emits only text deltas:
  - [Discover route stream loop (text deltas only)](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:174)
  - [Discover route tool-use detection](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:182)
  - [Discover route tool execution branch](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:190)
  - [Discover route follow-up stream](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:229)
- Agent service has tool/phase boundaries internally but only writes final assistant text:
  - [Agent `/chat` response headers `text/plain`](/Users/williamlobb/Documents/Repos/OC-Labs/agent/main.go:171)
  - [Agent run invocation](/Users/williamlobb/Documents/Repos/OC-Labs/agent/main.go:181)
  - [Tool iteration + execution point](/Users/williamlobb/Documents/Repos/OC-Labs/agent/agent.go:83)
  - [Tool call execution](/Users/williamlobb/Documents/Repos/OC-Labs/agent/agent.go:107)
  - [Only final text written](/Users/williamlobb/Documents/Repos/OC-Labs/agent/agent.go:113)
- Separate generic AI “thinking” state exists in task decomposition (`Thinking…` button text), not streaming:
  - [TaskBoard decomposing state](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:46)
  - [TaskBoard `Thinking…` labels](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:231)
  - [Plan API is single-response JSON, no stream](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/plan/route.ts:32)

**Relevant files**
- UI mount points:
  - [Discover page mounts assistant panel](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/discover/page.tsx:109)
  - [Project layout mounts chat panel](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/layout.tsx:59)
  - [DiscoverChatPanel -> DiscoverChat](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChatPanel.tsx:74)
  - [ProjectChatPanel -> ProjectChat](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChatPanel.tsx:90)
- UI render/state points for status UI insertion:
  - [DiscoverChat assistant render branch](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChat.tsx:136)
  - [ProjectChat assistant render branch](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx:149)
  - [Chat message type currently `content`-only](/Users/williamlobb/Documents/Repos/OC-Labs/src/types/index.ts:131)
- Stream/progress production points:
  - [Discover chat route](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:127)
  - [Project chat proxy route](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts:21)
  - [Agent HTTP entrypoint](/Users/williamlobb/Documents/Repos/OC-Labs/agent/main.go:130)
  - [Agent tool loop](/Users/williamlobb/Documents/Repos/OC-Labs/agent/agent.go:63)

**Risks/gaps**
- Current protocol is plain text end-to-end (`text/plain`), so phase/tool/reasoning updates cannot be surfaced without introducing a structured stream format.
- Chat message schemas are text-only; adding progress metadata requires type/state/storage updates (notably [ProjectChatPanel localStorage validator](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChatPanel.tsx:101)).
- No unit tests currently cover chat streaming UI/protocol parsing (only trim-history tests found), so regressions are likely during protocol changes.
- [SkeletonCard](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/ui/SkeletonCard.tsx:1) has pulse placeholders but appears unused in current app routes/components.

---

### Explorer B (backend/runtime flow)
**Current flow**
- Project chat uses `fetch` + streamed HTTP response body, not polling/SSE/WebSocket.
- Frontend posts `{ message, history[] }` to `/api/v1/projects/[id]/chat`, then reads `res.body.getReader()` and appends plain text chunks to one assistant message.
- Next Edge route authenticates/authorizes, trims history, forwards to Go agent `/chat`, then proxies upstream body as `text/plain` chunked.
- Go agent runs an internal tool loop (`tool_use` -> execute tool -> `tool_result` back to model). It only writes final assistant text to response; tool/state events are not emitted to client.
- Completion is implicit (`reader.read()` returns `done: true` / stream closes).
- Error paths:
  - Next route returns JSON `{ error: string }` for auth/validation/upstream failures.
  - Go route writes timeout/unexpected-error text into the same plain-text stream after headers are set.

**Relevant files**
- [src/components/chat/ProjectChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx)
- [src/app/api/v1/projects/[id]/chat/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts)
- [agent/main.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/main.go)
- [agent/agent.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/agent.go)
- [agent/tools.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/tools.go)
- [agent/tools_project.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/tools_project.go)
- [agent/tools_write.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/tools_write.go)
- [src/app/api/v1/discover/chat/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts)
- [supabase/migrations/007_chat_apikeys.sql](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/007_chat_apikeys.sql)

**Gaps**
- No client-visible schema for tool-call start/progress/result, thought/status updates, or explicit completion events in project chat.
- Project agent backend does not emit granular runtime events yet; only final text is streamed.
- Internal granular structures exist but are server-internal only:
  - Go loop consumes Anthropic `tool_use` blocks and creates `tool_result` blocks.
  - Discover route receives Anthropic stream events (`content_block_delta`) and `tool_use`, but only forwards text deltas.
- `project_chat_messages` table exists but is currently unused by runtime chat path.

**Suggested integration points**
- Add a typed event stream from Go agent (`text/event-stream`), e.g. `run_started`, `tool_started`, `tool_succeeded`, `tool_failed`, `text_delta`, `run_completed`, `run_failed`.
- Instrument `agent/agent.go` around each tool execution (`executeTool`) and model turn; emit events before/after calls.
- Optionally switch project agent inference to streaming model API so `text_delta` is truly token/delta-based.
- Update `/api/v1/projects/[id]/chat` to pass through SSE events (instead of plain text proxy).
- Update `ProjectChat.tsx` to parse event frames and render tool/state UI; keep plain-text fallback for backward compatibility.

---

### Explorer C (cross-cutting constraints)
**Reusable patterns**
- Existing incremental streaming pattern is already implemented for chat: server returns `text/plain` chunked streams and client consumes `ReadableStream.getReader()` with `TextDecoder` snapshots.
- Local UI state is mostly component-scoped `useState` with optimistic updates + rollback on failure (`ProjectActions`, `TaskBoard`, `ContextWorkbench`, `HandRaiseRequests`).
- Server-rendered pages use direct Supabase reads; write-side refresh pattern is `router.refresh()` (not polling/subscription).
- Shared permission checks are centralized in `canEditProjectContent` / `canEditProjectSettings` / `canManageMembers`.
- Per-request query dedupe uses `React.cache()` wrappers (`getCachedProject`, membership, vote).
- Existing “timeline-like” UI is `UpdatesFeed` (ordered by `posted_at`, milestone marker) plus blocked-task prompt generation that links into compose/update flow.

**Constraints**
- No existing realtime subscription infra: no `supabase.channel`, no `postgres_changes`, no `EventSource`, no websocket hooks, no realtime SQL publication config.
- Current stream contract is raw text chunks, not SSE event envelopes; no typed progress event schema exists.
- Middleware enforces auth redirect globally (except `/login`, `/auth/*`, `/signup`), so stream endpoints should expect authenticated sessions by default.
- RLS read policies for `updates`, `tasks`, `context_blocks` are broad (`authenticated`), so DB-level reads are not per-project/member restricted unless app logic adds checks.
- Permission/RLS mismatch exists:
  - `canEditProjectContent` includes `tech_lead` + `power_user`.
  - RLS write policies for `tasks`/`context_blocks` only allow `owner`/`contributor`.
  - UI edit gating on project pages also excludes `tech_lead` in several places.
- Updates POST currently supports session auth **or** bearer API key; if progress streaming should support agents, API-key auth behavior needs to be decided similarly.
- `project_chat_messages` table exists but is unused; chat messages are streamed and held client-side/localStorage, not persisted.
- No dedicated GET endpoint for updates feed (overview page reads Supabase directly in server component); this affects reusable API contracts for stream backfill.

**File list**
- [src/components/chat/ProjectChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx)
- [src/components/chat/DiscoverChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChat.tsx)
- [src/app/api/v1/projects/[id]/chat/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts)
- [src/app/api/v1/discover/chat/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts)
- [src/components/projects/UpdatesFeed.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/projects/UpdatesFeed.tsx)
- [src/components/projects/PostUpdateForm.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/projects/PostUpdateForm.tsx)
- [src/app/(app)/projects/[id]/page.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/page.tsx)
- [src/app/api/v1/projects/[id]/updates/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/updates/route.ts)
- [src/components/plan/TaskBoard.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx)
- [src/app/api/v1/projects/[id]/tasks/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/route.ts)
- [src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts)
- [src/lib/auth/permissions.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/auth/permissions.ts)
- [src/lib/auth/api-key.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/auth/api-key.ts)
- [src/lib/data/project-queries.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/data/project-queries.ts)
- [src/lib/supabase/server.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/supabase/server.ts)
- [src/lib/supabase/admin.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/supabase/admin.ts)
- [src/lib/supabase/middleware.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/supabase/middleware.ts)
- [middleware.ts](/Users/williamlobb/Documents/Repos/OC-Labs/middleware.ts)
- [src/types/index.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/types/index.ts)
- [supabase/migrations/001_initial.sql](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/001_initial.sql)
- [supabase/migrations/006_tasks.sql](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/006_tasks.sql)
- [supabase/migrations/007_chat_apikeys.sql](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/007_chat_apikeys.sql)
- [supabase/migrations/012a_rbac_enums.sql](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/012a_rbac_enums.sql)
- [supabase/migrations/012b_rbac_tables.sql](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/012b_rbac_tables.sql)
- [src/test/unit/api/updates-route.test.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/test/unit/api/updates-route.test.ts)
- [src/test/unit/components/PostUpdateForm.test.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/test/unit/components/PostUpdateForm.test.tsx)
- [src/test/unit/components/TaskBoard.test.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/test/unit/components/TaskBoard.test.tsx)
- [src/test/unit/middleware.test.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/test/unit/middleware.test.ts)
- [agent/main.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/main.go)
- [agent/agent.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/agent.go)
- [agent/tools_write.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/tools_write.go)

**Open questions**
- Should “progress stream” mean only `updates`, or a unified event feed across `updates + tasks + context + approvals + jira sync`?
- Should stream visibility be all authenticated users (current read RLS behavior) or project-member-only?
- Should non-browser clients (agent/API keys) be able to consume/publish stream events like updates POST currently does?
- Do we standardize on SSE/JSON event envelopes, or reuse current plain-text chunk streaming style?
- Do we want to reconcile `tech_lead`/`power_user` behavior across UI gating, permission helpers, and RLS before introducing stream auth logic?

---

### Explorer D (pattern-focused pass)
**Existing patterns**
- Streaming transport is plain text chunks, not structured events.
  - Discover chat writes Anthropic `text_delta` chunks directly to response body and returns `text/plain; charset=utf-8` with chunked transfer ([route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:158), [route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:255)).
  - Project chat route proxies upstream bytes from agent to client, also as plain text chunked ([route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts:111), [route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts:131)).
- Client incremental UI pattern is “single assistant placeholder + accumulated text replace”.
  - Both chat UIs append a blank assistant message, stream-read `res.body.getReader()`, accumulate decoded text, and replace that one message each chunk ([DiscoverChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChat.tsx:52), [DiscoverChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChat.tsx:81), [ProjectChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx:57), [ProjectChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx:93)).
- Request envelopes are JSON and minimal.
  - UI -> API chat payload: `{ message, history: [{ role, content }] }` in both flows ([DiscoverChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChat.tsx:62), [ProjectChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx:73)).
  - Project API -> agent payload extends this with `{ project_id, auth_token, base_url, github_repos, is_owner }` ([route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts:76), [main.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/main.go:20)).
- Error envelope convention in APIs is mostly `NextResponse.json({ error: string }, { status })`; chat UI for project explicitly parses both JSON and text and maps to friendly messages ([route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts:29), [ProjectChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx:213)).
- Key gap for “real progress”: agent currently writes only final text after tool loop, even though HTTP is chunked/flushed.
  - `Agent.Run` uses `Messages.New` (non-streaming) and writes once when no tool calls remain ([agent.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/agent.go:84), [agent.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/agent.go:113)).
  - So project chat is effectively near end-loaded unless agent emits intermediate writes ([main.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/main.go:181), [main.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/main.go:207)).

**Relevant files**
- [src/app/api/v1/discover/chat/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts)
- [src/app/api/v1/projects/[id]/chat/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts)
- [src/components/chat/DiscoverChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChat.tsx)
- [src/components/chat/ProjectChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx)
- [src/components/chat/ProjectChatPanel.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChatPanel.tsx)
- [src/components/chat/DiscoverChatPanel.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/DiscoverChatPanel.tsx)
- [src/lib/chat/trim-history.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/chat/trim-history.ts)
- [agent/main.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/main.go)
- [agent/agent.go](/Users/williamlobb/Documents/Repos/OC-Labs/agent/agent.go)

**Compatibility notes**
- If you keep current client code unchanged, progress must remain plain-text bytes; clients do not parse SSE/NDJSON envelopes today.
- If you introduce structured progress envelopes (`type: progress|delta|error`), both chat UIs must change parsing logic from raw text accumulation to framed-event parsing.
- Avoid storing progress as separate assistant messages; project history normalization collapses consecutive same-role entries and trims by char budget ([route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts:180), [route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/chat/route.ts:194)).
- The biggest leverage point is agent-side streaming (Go): switch from non-streaming completion (`Messages.New`) to streaming deltas and write as they arrive; project API pass-through already supports chunk relay.
- Preserve existing timeout/error UX contracts (friendly timeout/unavailable text mapping, JSON `{ error }` on non-OK) to avoid regressions in `ProjectChat` error extraction ([ProjectChat.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/chat/ProjectChat.tsx:213)).
