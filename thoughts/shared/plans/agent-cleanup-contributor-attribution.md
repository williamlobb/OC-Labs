# Plan: Agent Verbosity Fix + Session-Only Chat + Contributor Attribution

**Date**: 2026-04-08
**Research**: `thoughts/shared/research/2026-04-08-1400-agent-verbose-behavior.md`

## Context Summary

The Go agent eagerly calls `get_project_context` on every message (including greetings) because both the tool description and system prompt instruct it to do so. Chat history is persisted to a `project_chat_messages` Supabase table on every exchange — unnecessary, and was the source of the consecutive-user-message normalization bug. The updates feed lacks contributor attribution; context blocks have it in text but not visually; task cards have none.

---

## Phase 1: Fix agent system prompt and tool description (Go)

**Goal**: Stop the agent from fetching project context on every message.

**Files to change**:
- `agent/tools_project.go:13` — rewrite `get_project_context` Description:
  - BEFORE: `"Read the project's full context including title, summary, status, team members, and all context blocks. Always call this first before answering questions or making changes."`
  - AFTER: `"Read the project's context (title, summary, status, team members, context blocks). Call this when the user asks about the project, its status, or its configuration — not on every message."`

- `agent/main.go:45` — fix system prompt Tools section:
  - BEFORE: `"Use your tools to read project state before acting. Always check existing context and tasks before creating duplicates."`
  - AFTER: `"Only fetch project data when the user's request requires it. Before creating new context blocks or tasks, check for existing ones to avoid duplicates."`

**Acceptance criteria**:
- [ ] "hello" → agent responds without calling `get_project_context` (check agent logs)
- [ ] "what's the status of this project?" → agent does call `get_project_context`

---

## Phase 2: Remove dead payload fields from chat route

**Goal**: Stop sending `github_tools`/`task_tools` JSON fields the Go agent silently ignores.

**Files to change**:
- `src/app/api/v1/projects/[id]/chat/route.ts` — in the `fetch(AGENT_URL/chat)` body (lines 132-141):
  - Remove `github_tools` and `task_tools` properties
  - Delete `buildGithubToolsHint` function (lines 269-281)
  - Delete `buildTaskToolsHint` function (lines 244-253)

**Acceptance criteria**:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds

---

## Phase 3: Remove cross-session chat persistence, keep in-memory session

**Goal**: Chat history in React state only. No DB reads or writes for chat messages.

**Files to change**:

`src/app/api/v1/projects/[id]/chat/route.ts`:
- Delete entire `GET` handler (lines 14-52)
- In `POST` handler:
  - Remove `supabaseAdmin` import (line 3) — only used for chat persistence
  - Remove `historyRows` fetch from `Promise.all` (lines 86-94); keep only `project` query for `github_repos`
  - Remove user-message insert to `project_chat_messages` (lines 97-102)
  - Remove history normalization block (lines 111-125)
  - Read `history` from request body: `const { message, history: clientHistory } = body`
  - Pass `history: clientHistory ?? []` in agent POST body
  - Remove assistant-message inserts inside the `ReadableStream` (lines 167-174 and 177-183)
  - Remove `fullResponse` accumulation (line 153, 164) — no longer needed
  - Simplify stream to just relay chunks

`src/components/chat/ProjectChatPanel.tsx`:
- Remove `fetchedRef` ref and GET fetch in `handleOpen`
- `handleOpen` becomes simply `setCollapsed(false)`
- Remove `loading` state and loading spinner conditional
- Add "New session" button (near collapse chevron): `onClick={() => setMessages([])}` 
- Keep `messages` state typed as `ChatMessage[]`

`src/components/chat/ProjectChat.tsx`:
- In `handleSend`, add conversation history to POST body:
  `{ message: text, history: messages.map(m => ({ role: m.role, content: m.content })) }`

**Acceptance criteria**:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Open chat → send message → get response ✓
- [ ] Close panel, reopen → messages preserved (component state) ✓
- [ ] Refresh page → messages gone ✓
- [ ] Click "New session" → messages cleared ✓

---

## Phase 4: Contributor attribution — migration + types + API + agent

**Goal**: Add `author_name` to updates table; populate it from human user name or `'Omnia Agent'`.

**New file** — `supabase/migrations/011_update_author_name.sql`:
```sql
alter table public.updates
  add column if not exists author_name text;

-- Backfill from users table
update public.updates u
set author_name = coalesce(usr.name, 'Unknown')
from public.users usr
where u.author_id = usr.id
  and u.author_name is null;

-- Rows with no author_id default to 'Omnia Agent'
update public.updates
set author_name = 'Omnia Agent'
where author_name is null;
```

**Files to change**:

`src/types/index.ts:62-69` — add `author_name?: string` to `ProjectUpdate` interface

`src/app/api/v1/projects/[id]/updates/route.ts` (POST handler):
- Look up user name: `const { data: profile } = await supabaseAdmin.from('users').select('name').eq('id', userId).maybeSingle()`
- Resolve author name: `const authorName = typeof body.author_name === 'string' ? body.author_name : (profile?.name?.trim() || 'Unknown')`
- Add `author_name: authorName` to the insert object
- (Agent can override by sending `author_name: 'Omnia Agent'` in body)

`agent/tools_write.go`:
- Add `AuthorName string` field to `PostUpdateInput` struct with `jsonschema_description:"Display name of the author"`
- In the post_update function, set `input.AuthorName = "Omnia Agent"` before POSTing (or include in the struct literal)

**Acceptance criteria**:
- [ ] Migration applies cleanly
- [ ] Human-posted update → `author_name` is user's real name
- [ ] Agent-posted update → `author_name` is `'Omnia Agent'`

---

## Phase 5: Contributor attribution — UI components

**Goal**: Subtle GitHub-style contributor chip on updates, context blocks, and task cards.

**New file** — `src/components/ui/ContributorChip.tsx`:
```tsx
// No "use client" — works in both Server and Client components
import { avatarColor } from '@/lib/utils/avatar'

interface ContributorChipProps {
  authorId?: string | null
  authorName?: string | null
  isAgent?: boolean
}

export function ContributorChip({ authorId, authorName, isAgent }: ContributorChipProps) {
  const displayName = authorName || 'Unknown'
  const agent = isAgent || authorName === 'Omnia Agent'

  if (agent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
        {/* Small sparkle/bot SVG icon, h-4 w-4 */}
        <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 0l1.5 4.5H12L8.25 7.5 9.75 12 6 9 2.25 12l1.5-4.5L0 4.5h4.5z" />
        </svg>
        {displayName}
      </span>
    )
  }

  const { bg, fg } = avatarColor(authorId ?? '')
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
        style={{ backgroundColor: bg, color: fg }}
        aria-hidden
      >
        {initials}
      </span>
      {displayName}
    </span>
  )
}
```

**Files to change**:

`src/components/projects/UpdatesFeed.tsx`:
- Import `ContributorChip`
- Replace plain date `<p>` (line 38) with a flex row:
  ```tsx
  <div className="flex items-center gap-2">
    <ContributorChip
      authorId={update.author_id}
      authorName={update.author_name}
    />
    <span className="text-xs text-zinc-400">{formatDate(update.posted_at)}</span>
  </div>
  ```

`src/components/context/ContextBlockList.tsx`:
- Import `ContributorChip`
- Replace line 136 plain text:
  ```tsx
  <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
    <ContributorChip authorId={block.author_id} authorName={block.author_name} />
    <span>· {new Date(block.created_at).toLocaleString()}</span>
  </div>
  ```

`src/components/plan/TaskCard.tsx`:
- Import `ContributorChip`
- Look up creator name from `teamMembers` prop (already available) using `task.created_by`
- Add chip in task card footer:
  ```tsx
  const creatorMember = teamMembers.find(m => m.user_id === task.created_by)
  const isAgentTask = task.assigned_to_agent && !creatorMember
  // ...in JSX, before or after the status badge:
  <ContributorChip
    authorId={task.created_by}
    authorName={creatorMember?.user?.name ?? (isAgentTask ? 'Omnia Agent' : undefined)}
    isAgent={isAgentTask}
  />
  ```

**Acceptance criteria**:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Updates feed: each update shows avatar chip + name + date
- [ ] Agent-authored items: sparkle icon + "Omnia Agent"
- [ ] Context blocks: chip replaces plain "Added by" text
- [ ] Task cards: creator chip visible, agent tasks show "Omnia Agent"

---

## Phase 6: Build verification and deploy

**Steps** (in order):
1. `npx tsc --noEmit` — must pass cleanly
2. `npm run build` — must succeed
3. `npm run lint` — must pass
4. Apply migration: run `011_update_author_name.sql` against Supabase project `lmhntrqbxrzltppafjnu`
5. Deploy Go agent: `cd agent && fly deploy` (rebuilds binary and deploys to Fly.io)
6. Deploy Next.js: push branch → merge → Vercel auto-deploys
7. Production smoke tests:
   - Send "hello" → no `get_project_context` call in agent logs
   - Open chat → no GET request to `/api/v1/projects/.../chat`
   - Click "New session" → messages clear
   - Post an update → contributor chip appears with real name
   - Agent posts an update → sparkle + "Omnia Agent"

**Deploy order matters**: Apply migration BEFORE deploying Next.js (the POST /updates handler will write `author_name`).

---

## Rejected Alternatives

- **Drop `project_chat_messages` table**: Keep it (potential future audit), just stop reading/writing.
- **Add `author_name` as NOT NULL on updates**: Nullable is safer for rolling deploy.
- **Two separate avatar components**: One `ContributorChip` handles both cases.
- **Add `created_by_name` column to tasks**: Scope creep; use teamMembers lookup instead.
- **Keep buildGithubToolsHint "for future use"**: Dead payload. Delete it. Go agent has proper tool defs.

## Open Questions

1. **Sparkle icon**: The plan uses a star path SVG. Implementer may choose a different icon (e.g. a simple circle with `·` or a small robot emoji via CSS). Keep it `h-3 w-3`, zinc-400, no fill colour change.
2. **Migration numbering**: Assumes `011` is free. Check `supabase/migrations/` before running.
3. **"New session" button label**: Could be "New session", "Clear chat", or just an × icon. Keep it small and secondary — not a primary action.
