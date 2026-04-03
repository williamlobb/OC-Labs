# OC Labs — Phase 1 Fixes + Phase 2 Build Specification

**Date:** 2026-04-03
**Status:** Ready for implementation
**Scope:** Phase 1 gap fixes + Phase 2 (PRs 11–13) complete

---

## Current State (from audit)

The app is live at oclabs.space. Authenticated users can browse the discover board, view project detail pages, vote, raise hand, create/edit projects, and view/edit their profile. The following gaps remain.

---

## Part A — Phase 1 Fixes

### A1 — Vote/Raise Hand on project detail page are HTML form POSTs (not interactive)

**Problem:** The detail page uses `<form method="POST">` which causes a full page reload and navigates to the raw API JSON response. The card uses optimistic client-side handlers correctly; the detail page does not.

**Fix:** Replace the form elements in `src/app/(app)/projects/[id]/page.tsx` with a `'use client'` wrapper component `src/components/projects/ProjectActions.tsx` that mirrors the card's optimistic vote/join behaviour.

**Acceptance criteria:**
- [ ] Clicking Vote on detail page toggles state without page reload
- [ ] Vote count updates optimistically
- [ ] Clicking Raise Hand toggles without page reload
- [ ] Cannot vote/raise hand on own project (button hidden for owner)
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### A2 — APP_URL hardcoded to wrong domain

**Problem:** `src/lib/email/digest.ts` and `src/lib/notifications/slack-events.ts` both hardcode `https://labs.theoc.ai`. Production is `https://oclabs.space`.

**Fix:** Read from `process.env.NEXT_PUBLIC_APP_URL` with fallback to `https://oclabs.space`. Add `NEXT_PUBLIC_APP_URL=https://oclabs.space` to `.env.local.example`.

**Acceptance criteria:**
- [ ] Both files use `process.env.NEXT_PUBLIC_APP_URL ?? 'https://oclabs.space'`
- [ ] `.env.local.example` includes `NEXT_PUBLIC_APP_URL`

---

### A3 — `notion_url` missing from DB schema

**Problem:** `projects` table has no `notion_url` column. The form and API write it but it silently drops.

**Fix:** Add migration `004_notion_url.sql`:
```sql
alter table public.projects add column if not exists notion_url text;
```

**Acceptance criteria:**
- [ ] `notion_url` persists when saved via project form
- [ ] Migration file exists and is applied to remote

---

### A4 — `src/components/ui/` primitives missing

**Problem:** Avatar, Badge, SkeletonCard are inlined in ProjectCard. Phase 2 components need them as shared primitives.

**Fix:** Extract into:
- `src/components/ui/Avatar.tsx` — initials avatar with `avatarColor(userId)`
- `src/components/ui/Badge.tsx` — status badge
- `src/components/ui/SkeletonCard.tsx` — loading skeleton

Update ProjectCard to import from these. No visual change.

**Acceptance criteria:**
- [ ] Three files exist and are used by ProjectCard
- [ ] `npx tsc --noEmit` passes

---

## Part B — Phase 2: AI-Native Capabilities

### Dependencies to install
```bash
npm install @anthropic-ai/sdk
```
Add to `.env.local.example`:
```
ANTHROPIC_API_KEY=sk-ant-your-key
NEXT_PUBLIC_APP_URL=https://oclabs.space
```

---

### PR-11 — Context Engineering Workbench

**Concept:** Every project gets a Context tab. Members author structured context blocks (architecture decisions, constraints, tribal knowledge). Blocks are versioned and exportable as MCP-ready JSON for agent consumption.

#### Schema — `supabase/migrations/005_context_blocks.sql`
```sql
create table public.context_blocks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  author_id uuid references public.users(id),
  title text not null,
  body text not null,
  block_type text default 'general',
  version integer default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.context_blocks enable row level security;

create policy "read context blocks" on public.context_blocks
  for select using (auth.role() = 'authenticated');

create policy "write context blocks" on public.context_blocks
  for all using (
    exists (
      select 1 from public.project_members
      where project_id = context_blocks.project_id
        and user_id = auth.uid()
        and role in ('owner', 'contributor')
    )
  );
```

#### Files to create
- `src/app/(app)/projects/[id]/context/page.tsx` — Context tab (Server Component)
- `src/components/context/ContextBlockList.tsx` — list with type badges
- `src/components/context/ContextBlockEditor.tsx` — create/edit form (`'use client'`)
- `src/app/api/v1/projects/[id]/context/route.ts` — GET (MCP JSON), POST (create)
- `src/app/api/v1/projects/[id]/context/[blockId]/route.ts` — PUT, DELETE

#### Navigation
Add "Context" tab link to project detail page layout.

#### MCP export format (GET response)
```json
{
  "project": { "id", "title", "summary", "status", "skills_needed" },
  "team": [{ "name", "role" }],
  "blocks": [{ "id", "title", "body", "block_type", "version", "created_at" }]
}
```

**Acceptance criteria:**
- [ ] Context tab visible on project detail page
- [ ] Owner + contributors can create/edit/delete blocks
- [ ] Block types: Architecture, Decision, Constraint, General — shown as coloured badges
- [ ] `GET /api/v1/projects/[id]/context` returns MCP JSON readable by any authenticated user
- [ ] Empty state shown when no blocks exist
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-12 — Plan Mode + AI Task Decomposition

**Concept:** Projects get a Plan tab. "Decompose with AI" sends project title + description + context blocks to Claude and returns a structured task list rendered as a kanban board.

#### Schema — `supabase/migrations/006_tasks.sql`
```sql
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  body text,
  status text default 'todo',
  assignee_id uuid references public.users(id),
  assigned_to_agent boolean default false,
  depends_on uuid[] default '{}',
  created_by uuid references public.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.tasks enable row level security;

create policy "read tasks" on public.tasks
  for select using (auth.role() = 'authenticated');

create policy "write tasks" on public.tasks
  for all using (
    exists (
      select 1 from public.project_members
      where project_id = tasks.project_id
        and user_id = auth.uid()
        and role in ('owner', 'contributor')
    )
  );
```

#### Files to create
- `src/app/(app)/projects/[id]/plan/page.tsx` — Plan tab (Server Component)
- `src/components/plan/TaskBoard.tsx` — 4-column kanban (`'use client'`)
- `src/components/plan/TaskCard.tsx` — task with assignee, agent flag, dependency count
- `src/app/api/v1/projects/[id]/plan/route.ts` — POST: calls Claude, saves tasks, returns list
- `src/app/api/v1/projects/[id]/tasks/route.ts` — GET, POST
- `src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts` — PATCH, DELETE
- `src/lib/ai/decompose.ts` — Claude API call via `@anthropic-ai/sdk`

#### Claude call (`src/lib/ai/decompose.ts`)
- Model: `claude-3-5-haiku-20241022`
- Input: project title, summary, context blocks
- Output: JSON array `[{ title, body, status, assigned_to_agent }]`
- Max tokens: 2048
- Parse response as JSON; on parse failure return empty array

#### Task status update
Button toggle on TaskCard: `todo → in_progress → done`, separate `blocked` toggle. No drag-and-drop.

**Acceptance criteria:**
- [ ] Plan tab visible on project detail page
- [ ] "Decompose with AI" populates task list from Claude
- [ ] Tasks rendered in 4-column kanban (Todo / In Progress / Done / Blocked)
- [ ] Tasks assignable to team members via dropdown
- [ ] Tasks flaggable as "Agent task"
- [ ] Task status togglable via button
- [ ] Empty state with "Decompose with AI" CTA
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-13 — Project AI Chat + Agent API Keys

#### Schema — `supabase/migrations/007_chat_apikeys.sql`
```sql
create table public.project_chat_messages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  role text not null,
  content text not null,
  author_id uuid references public.users(id),
  created_at timestamp with time zone default now()
);

alter table public.project_chat_messages enable row level security;

create policy "read chat" on public.project_chat_messages
  for select using (auth.role() = 'authenticated');

create policy "write chat" on public.project_chat_messages
  for insert with check (author_id = auth.uid());

create table public.api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  key_hash text not null unique,
  label text,
  created_at timestamp with time zone default now(),
  last_used_at timestamp with time zone
);

alter table public.api_keys enable row level security;

create policy "manage own api keys" on public.api_keys
  for all using (user_id = auth.uid());
```

#### Sub-feature 1 — Project AI Chat

**Files to create:**
- `src/app/(app)/projects/[id]/chat/page.tsx` — Chat tab (Server Component, loads history)
- `src/components/chat/ProjectChat.tsx` — streaming chat UI (`'use client'`)
- `src/app/api/v1/projects/[id]/chat/route.ts` — POST, streams Claude response

**Chat behaviour:**
- System prompt = MCP context export from PR-11
- Streaming via native `ReadableStream`
- User + assistant messages saved to `project_chat_messages`
- History: last 50 messages loaded on mount
- Only project members (any role) can chat; 401 for non-members

**Acceptance criteria:**
- [ ] Chat tab visible on project detail page
- [ ] Messages stream in real-time
- [ ] Chat history persists across sessions
- [ ] System prompt includes project context blocks
- [ ] Non-members get 401

#### Sub-feature 2 — Agent API Keys

**Files to create:**
- `src/app/(app)/settings/api-keys/page.tsx` — API key management UI
- `src/app/api/v1/users/me/api-keys/route.ts` — GET list, POST create
- `src/app/api/v1/users/me/api-keys/[keyId]/route.ts` — DELETE revoke
- `src/app/api/v1/projects/[id]/updates/route.ts` — POST update (session auth OR bearer API key)
- `src/lib/auth/api-key.ts` — `verifyApiKey(req)` helper

**Key generation:** `crypto.randomBytes(32).toString('hex')` — shown once, stored as SHA-256 hash.

**Nav:** Add "Settings" link to `src/app/(app)/layout.tsx`.

**Acceptance criteria:**
- [ ] Settings page accessible from nav
- [ ] User can create API key with label — full key shown once
- [ ] User can revoke keys
- [ ] `last_used_at` updates on each use
- [ ] Agents can POST project updates via `Authorization: Bearer {key}`
- [ ] Invalid/revoked keys return 401
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

## Migration Execution Order

After each migration file is created:
```bash
/tmp/supabase db push
```

| File | Contents |
|------|----------|
| `004_notion_url.sql` | `projects.notion_url` column |
| `005_context_blocks.sql` | `context_blocks` table + RLS |
| `006_tasks.sql` | `tasks` table + RLS |
| `007_chat_apikeys.sql` | `project_chat_messages`, `api_keys` + RLS |

---

## Implementation Order

```
A1 — ProjectActions component
A2 — Fix APP_URL
A3 — Migration 004 + push
A4 — Extract ui/ primitives

npm install @anthropic-ai/sdk

PR-11 — migration 005 → API routes → UI tabs
PR-12 — migration 006 → decompose lib → API → kanban UI
PR-13 — migration 007 → chat API + UI → api-key API + settings UI

Final: add Context/Plan/Chat/Settings to nav
Final: npx tsc --noEmit && npm run lint
Final: git commit + push → Vercel deploy
```

---

## Design Principles (apply to every component)

- **Abstract complexity** — AI calls, streaming, DB writes happen invisibly. Users see outcomes, not mechanics. No loading spinners with technical labels, no raw error objects, no "calling Claude..." messages.
- **Clean UI, minimal noise** — No redundant labels, no decorative chrome. Every element earns its place. Match the existing zinc/white aesthetic exactly.
- **Progressive disclosure** — Show the simple thing first. Advanced options (block type, agent flag, depends_on) are secondary, not prominent.
- **Empty states are invitations** — Every empty state has one clear CTA, not explanatory paragraphs.
- **Errors are quiet** — Inline, small, red text. No modals, no toasts for non-critical failures.

---

## Completion Criteria

The Ralph loop is done when ALL of the following are true:

**Phase 1 fixes:**
- [ ] Vote/Raise Hand on project detail page work without page reload
- [ ] APP_URL env var used in digest and slack-events
- [ ] `notion_url` column exists and saves correctly
- [ ] `src/components/ui/` has Avatar, Badge, SkeletonCard

**Phase 2:**
- [ ] Context tab: create/edit/delete blocks, MCP JSON export at `/api/v1/projects/[id]/context`
- [ ] Plan tab: AI decompose creates tasks, kanban board renders and is interactive
- [ ] Chat tab: streaming Claude responses grounded in context blocks
- [ ] Settings page: create/revoke API keys; agents can POST updates via bearer token
- [ ] Migrations 004–007 applied to Supabase remote
- [ ] `ANTHROPIC_API_KEY` and `NEXT_PUBLIC_APP_URL` in `.env.local.example`
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] Pushed to `main` → Vercel deploys without build errors
