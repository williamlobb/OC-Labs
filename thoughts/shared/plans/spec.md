# OC Labs — Full Build Specification

**Date:** 2026-04-03  
**Status:** Draft — awaiting user confirmation  
**Scope:** Pre-flight hygiene + Auth fix + Phase 1 (PRs 02–10) + Phase 2 (AI capabilities)  
**Research source:** `thoughts/shared/research/OC labs  extended capability research.md`

---

## Problem Statement

OC Labs is the Omnia Collective's internal platform for project discovery, collaboration, and capability building. PR-01 (auth) was implemented but the app has a 404 after login due to a missing layout file. The branch structure is messy and needs cleaning before further work begins. Once hygiene is done, PRs 02–10 complete the MVP, and Phase 2 adds AI-native capabilities that make OC Labs a context engineering and agentic development hub for citizen engineers across the collective.

---

## Step 0 — Pre-flight: Branch Hygiene

### Current branch state (14 branches)

| Branch | Status | Action |
|--------|--------|--------|
| `main` | Production — has commits not in develop (research uploads, memory files, config) | **Keep — becomes the only integration branch** |
| `develop` | Has 4 commits not in main (auth shell implementation). 9 commits behind main. | **Merge into main, then delete** |
| `docs/agent-context` | Fully merged into main | **Delete** |
| `feat/pr-01-auth-shell` | Fully merged into main | **Delete** |
| `phase/1-mvp` | Fully merged into main | **Delete** |
| `feat/pr-02` through `feat/pr-10` | Stub only — 1 commit each, not merged | **Keep — implementation targets** |

### Branch strategy going forward

**`main` is the only long-lived branch.** No `develop`. Feature branches (`feat/pr-XX-*`) are created from `main`, implemented, and merged back to `main` via PR. Vercel deploys `main` to production automatically.

### Hygiene execution order

1. Merge `develop` into `main` (captures the 4 auth commits not yet in main)
2. Delete `develop`, `docs/agent-context`, `feat/pr-01-auth-shell`, `phase/1-mvp`
3. Rebase all `feat/pr-02` through `feat/pr-10` branches onto the new `main` HEAD
4. Update all open PRs on GitHub to target `main` instead of `develop`
5. Update `AGENTS.md` branch table to remove `develop`

### Acceptance criteria — hygiene complete
- [ ] `git branch -r` shows only `main` + 9 `feat/pr-*` branches
- [ ] All open PRs on GitHub target `main`
- [ ] `AGENTS.md` branch table updated
- [ ] `main` contains all commits from former `develop`

---

## Step 1 — Auth Fix: `(app)/layout.tsx` Missing

### Root cause

After login, the user is redirected to `/discover`. This route lives inside `src/app/(app)/`. The `(app)` route group has **no `layout.tsx`** — it was specified in the PR-01 plan but never created. Next.js cannot render any route inside `(app)/` without it, producing a 404.

### Fix

Create `src/app/(app)/layout.tsx` — a minimal authenticated shell with top nav and sign-out.

Also needs: `src/components/auth/SignOutButton.tsx` — a `'use client'` component that calls `supabase.auth.signOut()` and redirects to `/login`.

### Acceptance criteria — auth fix complete
- [ ] Visiting `/login` with valid credentials redirects to `/discover` without 404
- [ ] `/discover` renders (stub content is fine at this stage)
- [ ] Nav bar visible: OC Labs wordmark, Profile link, Sign Out button
- [ ] Sign Out clears session and redirects to `/login`
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] Deployed to `main` — Vercel confirms no 404

---

## Phase 1 — Complete the MVP (PRs 02–10)

All PRs branch from `main`, merge back to `main`. Vercel deploys on merge.

---

### PR-02 — Project Card Component
**Branch:** `feat/pr-02-project-card`  
**Depends on:** Step 1 (auth fix)

**Files to create:**
- `src/components/projects/ProjectCard.tsx`
- `src/components/ui/Avatar.tsx` — initials avatar using `avatarColor(userId)`
- `src/components/ui/Badge.tsx` — status badge
- `src/components/ui/SkeletonCard.tsx` — loading skeleton

**Acceptance criteria:**
- [ ] Card renders: title, brand, status badge, summary excerpt (120 chars), skills chips, owner avatar, vote count, member count
- [ ] Vote button togglable with optimistic UI (`useOptimistic`)
- [ ] Raise Hand button toggles with optimistic UI
- [ ] `needsHelp=true` shows a visible indicator
- [ ] Clicking card navigates to `/projects/[id]`
- [ ] Skeleton renders when `loading=true`
- [ ] Responsive: 1-col mobile, 2-col tablet, 3-col desktop
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-03 — Discovery Board
**Branch:** `feat/pr-03-discovery-board`  
**Depends on:** PR-02

**Files to create:**
- `src/app/(app)/discover/page.tsx` — Server Component, fetches projects ordered by `vote_count DESC`
- `src/components/board/BoardToolbar.tsx` — search input + filter chips
- `src/components/board/FilterChips.tsx` — status filter chips
- `src/components/board/FilterableBoard.tsx` — Client Component for filter/search state

**Acceptance criteria:**
- [ ] Server Component fetches all projects from Supabase on load
- [ ] Grid layout: 1/2/3-col responsive
- [ ] Filter by status (all `ProjectStatus` values)
- [ ] Debounced search (300ms) by title, summary, brand
- [ ] Empty state when no projects match
- [ ] Pagination: 20 projects per page
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-04 — Project Detail Page
**Branch:** `feat/pr-04-project-detail`  
**Depends on:** PR-02

**Files to create:**
- `src/app/(app)/projects/[id]/page.tsx` — Server Component
- `src/components/projects/ProjectHeader.tsx`
- `src/components/projects/TeamList.tsx`
- `src/components/projects/UpdatesFeed.tsx`
- `src/components/projects/RepoPreview.tsx` — uses `fetchRepoMetadata`

**Acceptance criteria:**
- [ ] Header: title, description, status badge, skills, `repo_url` + `notion_url` links
- [ ] Team member list with roles and avatars
- [ ] Updates/activity feed from `updates` table, newest first
- [ ] Vote + Raise Hand buttons (same behaviour as card)
- [ ] Edit button visible only to project owner
- [ ] RepoPreview: name, description, stars, language, last updated, README excerpt (500 chars)
- [ ] RepoPreview gracefully handles null (rate limited / not found)
- [ ] GitHub fetch cached: `next: { revalidate: 3600 }`
- [ ] 404 for missing projects
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-05 — Vote and Raise Hand
**Branch:** `feat/pr-05-vote-raise-hand`  
**Depends on:** Step 1 (auth fix)

**Files to create:**
- `src/app/api/v1/projects/[id]/vote/route.ts` — POST toggle vote
- `src/app/api/v1/projects/[id]/raise-hand/route.ts` — POST toggle raise-hand

**Acceptance criteria:**
- [ ] Vote: toggles `votes` table row, updates `projects.vote_count` via Supabase RPC (no direct UPDATE)
- [ ] Vote: returns `{ voteCount: number, hasVoted: boolean }`
- [ ] Raise Hand: toggles `project_members` row (role: `'interested'`)
- [ ] Raise Hand: calls `dmOwnerRaisedHand()` on join
- [ ] Cannot vote or raise hand on own project
- [ ] Session user only — never trust client-supplied user ID
- [ ] Returns 401 if unauthenticated
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-06 — Create and Edit Project Form
**Branch:** `feat/pr-06-create-edit-form`  
**Depends on:** Step 1 (auth fix)

**Files to create:**
- `src/app/(app)/projects/new/page.tsx`
- `src/app/(app)/projects/[id]/edit/page.tsx` — owner only
- `src/app/api/v1/projects/route.ts` — POST create
- `src/app/api/v1/projects/[id]/route.ts` — PUT update, DELETE
- `src/components/projects/ProjectForm.tsx` — shared form component

**Acceptance criteria:**
- [ ] Fields: title, description, status, skills_needed (tag input), github_repos (multi-input), notion_url
- [ ] Client-side validation (required fields, URL format)
- [ ] On create: inserts project, inserts owner into `project_members` (role: `'owner'`), calls `notifyProjectUpdate()`
- [ ] Redirects to `/projects/[id]` after create
- [ ] Edit form pre-populated, restricted to owner
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-07 — User Profile Page
**Branch:** `feat/pr-07-user-profile`  
**Depends on:** Step 1 (auth fix)

**Files to create:**
- `src/app/(app)/profile/[id]/page.tsx` — public view
- `src/app/(app)/profile/me/page.tsx` — own profile with edit
- `src/components/profile/ProfileCard.tsx`
- `src/components/profile/SkillChips.tsx`
- `src/app/api/v1/users/me/route.ts` — PATCH

**Acceptance criteria:**
- [ ] Avatar: photo if available, else initials with `avatarColor(userId)`
- [ ] Displays: name, title, brand, skills, projects owned/contributed to
- [ ] LinkedIn and GitHub links if present
- [ ] CoWork sync status indicator
- [ ] Own profile: editable fields are `linkedin_url`, `github_username`, skills only
- [ ] Name, title, brand, photo are read-only (CoWork-sourced)
- [ ] PATCH validates input, updates only allowed fields
- [ ] 404 for unknown user IDs
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-08 — Slack Notifications
**Branch:** `feat/pr-08-slack-wiring`  
**Depends on:** PR-05, PR-06

**Files to create/verify:**
- `src/app/api/v1/projects/[id]/needs-help/route.ts` — POST toggle `needs_help`
- Wire `notifyNeedsHelp()` into needs-help toggle
- Wire `notifyMilestone()` when `vote_count` crosses 10
- Verify `notifyProjectUpdate()` fires on project create (PR-06)

**Acceptance criteria:**
- [ ] New project → posts to `#omnia-projects` (Block Kit, includes project link)
- [ ] Member raises hand → posts to `#omnia-projects`
- [ ] Project hits 10 votes → posts to `#wins`
- [ ] Needs-help toggled true → posts to `#omnia-projects`
- [ ] Slack calls are fire-and-forget (never block the main action)
- [ ] Slack errors logged but never return 500 to client
- [ ] Only project owner can toggle `needs_help`
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-09 — Weekly Email Digest
**Branch:** `feat/pr-09-email-digest`  
**Depends on:** PR-03

**Files to create:**
- `src/app/api/cron/digest/route.ts` — GET, secured with `CRON_SECRET`
- `src/lib/email/digest.ts` — full implementation (stub exists)
- `src/app/api/v1/users/me/unsubscribe/route.ts` — GET unsubscribe handler
- `vercel.json` — cron schedule

**Schema addition:**
```sql
-- supabase/migrations/002_email_digest.sql
alter table public.users add column if not exists email_digest boolean default true;
```

**Acceptance criteria:**
- [ ] Endpoint returns 401 without `Authorization: Bearer {CRON_SECRET}` header
- [ ] Queries projects created/updated in last 7 days
- [ ] Sends to all users where `email_digest = true`
- [ ] Email: subject, top 5 projects by vote count, CTA to `/discover`, unsubscribe link
- [ ] Unsubscribe link sets `users.email_digest = false`
- [ ] Vercel cron runs weekly (Monday 08:00 AEST)
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-10 — CoWork Sync
**Branch:** `feat/pr-10-cowork-sync`  
**Depends on:** Step 1 (auth fix)

**Files to create/implement:**
- `src/app/api/webhooks/cowork/route.ts` — POST webhook receiver
- `src/lib/cowork/sync.ts` — full implementation (stub exists)
- Wire sync into `src/app/auth/callback/route.ts` (on login)

**Acceptance criteria:**
- [ ] `/api/webhooks/cowork` receives project update events, upserts records (idempotent)
- [ ] On login: fetches CoWork profile, updates `name`, `title`, `brand`, `profile_photo_url`, sets `cowork_synced_at`
- [ ] CoWork fields never writable via user-facing API
- [ ] Structured JSON error logging on sync failure
- [ ] Login succeeds even if CoWork is unreachable
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

## Phase 2 — AI-Native Capabilities (PRs 11–13)

Phase 2 begins after all Phase 1 PRs are merged to `main`. Three tracks implemented in order due to dependencies.

**AI provider:** Anthropic Claude API via `ANTHROPIC_API_KEY`. Add to `.env.local.example`.

---

### PR-11 — Context Engineering Workbench
**Branch:** `feat/pr-11-context-workbench`  
**Depends on:** PR-04 (project detail page)

**Concept:** Every project becomes an agent-addressable context artifact. Members author structured context blocks (architecture decisions, constraints, tribal knowledge) that are versioned, attached to projects, and exportable as MCP-ready JSON.

**Schema:**
```sql
-- supabase/migrations/003_context_blocks.sql
create table public.context_blocks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  author_id uuid references public.users(id),
  title text not null,
  body text not null,
  block_type text default 'general', -- 'architecture' | 'constraint' | 'decision' | 'general'
  version integer default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

**Files to create:**
- `src/app/(app)/projects/[id]/context/page.tsx` — Context tab on project detail
- `src/components/context/ContextBlockEditor.tsx` — create/edit block form
- `src/components/context/ContextBlockList.tsx` — versioned list
- `src/app/api/v1/projects/[id]/context/route.ts` — GET (MCP export), POST (create)
- `src/app/api/v1/projects/[id]/context/[blockId]/route.ts` — PUT, DELETE

**Acceptance criteria:**
- [ ] Project detail has a "Context" tab alongside Updates
- [ ] Members can create/edit/delete blocks (owner + contributors only)
- [ ] Block types: Architecture, Decision, Constraint, General
- [ ] Previous versions viewable
- [ ] `GET /api/v1/projects/[id]/context` returns structured JSON: project metadata + team + all blocks
- [ ] Export readable by any authenticated user (for agent consumption)
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-12 — Plan Mode + Task Decomposition
**Branch:** `feat/pr-12-plan-mode`  
**Depends on:** PR-11 (context blocks used as AI input)

**Concept:** Projects get a Plan tab. AI decomposes the project into agent-executable tasks with dependency mapping. Tasks are assignable to humans or flagged for agents.

**Schema:**
```sql
-- supabase/migrations/004_tasks.sql
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  body text,
  status text default 'todo', -- 'todo' | 'in_progress' | 'done' | 'blocked'
  assignee_id uuid references public.users(id),
  assigned_to_agent boolean default false,
  depends_on uuid[] default '{}',
  created_by uuid references public.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

**Files to create:**
- `src/app/(app)/projects/[id]/plan/page.tsx` — Plan tab
- `src/components/plan/TaskBoard.tsx` — kanban board (Todo / In Progress / Done / Blocked)
- `src/components/plan/TaskCard.tsx` — task with dependency indicators
- `src/components/plan/DependencyGraph.tsx` — SVG dependency graph
- `src/app/api/v1/projects/[id]/plan/route.ts` — POST decompose (calls Claude)
- `src/app/api/v1/projects/[id]/tasks/route.ts` — CRUD
- `src/lib/ai/decompose.ts` — Claude API call, returns structured task list

**Acceptance criteria:**
- [ ] Project detail has a "Plan" tab
- [ ] "Decompose with AI" sends title + description + context blocks to Claude, returns task list
- [ ] Tasks rendered as kanban board
- [ ] Tasks show dependency indicators
- [ ] Dependency graph renders for projects with > 3 tasks
- [ ] Tasks assignable to team members or flagged as "agent task"
- [ ] Status updates via drag-and-drop or toggle
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

### PR-13 — Persona UX + Progressive Agent Participation
**Branch:** `feat/pr-13-persona-agent`  
**Depends on:** PR-11 (context export used as chat system prompt)

**Schema:**
```sql
-- supabase/migrations/005_persona_agent.sql
alter table public.users add column if not exists persona text default 'engineer';
-- 'citizen' | 'engineer' | 'lead' | 'agent'
alter table public.users add column if not exists is_agent boolean default false;

create table public.project_chat_messages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  role text not null, -- 'user' | 'assistant'
  content text not null,
  author_id uuid references public.users(id),
  created_at timestamp with time zone default now()
);

create table public.api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  key_hash text not null unique,
  label text,
  created_at timestamp with time zone default now(),
  last_used_at timestamp with time zone
);
```

**Sub-feature C1 — Persona-based UX:**
- `src/components/board/PersonaToggle.tsx` — Citizen / Engineer / Lead switcher in nav
- Citizen mode: simplified cards, plain-language status labels, no technical fields
- Engineer mode: full current UI
- Lead mode: adds "Skills gap" panel on board (most-needed skills across all projects)
- Persona stored in `users.persona`, persists across sessions

**Sub-feature C2 — Project AI Chat:**
- `src/app/(app)/projects/[id]/chat/page.tsx` — Chat tab on project detail
- `src/components/chat/ProjectChat.tsx` — streaming chat UI
- `src/app/api/v1/projects/[id]/chat/route.ts` — POST, streams Claude response
- System prompt built from PR-11 context export
- Chat history stored in `project_chat_messages`

**Sub-feature C3 — Agent as Project Member:**
- Agent users: `is_agent = true`, `persona = 'agent'`, visually distinct in team lists
- `src/app/api/v1/projects/[id]/updates/route.ts` — POST update (human or agent via API key)
- `src/app/(app)/settings/api-keys/page.tsx` — API key create/revoke UI
- Agents authenticate via `Authorization: Bearer {api_key}` header

**Acceptance criteria:**
- [ ] Persona toggle in nav, persists to DB
- [ ] Citizen mode hides skills chips, GitHub links, raw vote numbers
- [ ] Lead mode adds skills gap panel on `/discover`
- [ ] Chat tab available to all authenticated project members
- [ ] Chat streams responses (no full-page reload)
- [ ] Agent users show distinct icon in team lists
- [ ] Agents can POST updates via API key auth
- [ ] API key UI: create with label, revoke, see last-used timestamp
- [ ] `npx tsc --noEmit` passes, `npm run lint` passes

---

## Schema Migration Summary

| File | Contents | Phase |
|------|----------|-------|
| `supabase/migrations/002_email_digest.sql` | `users.email_digest` column | Phase 1 — PR-09 |
| `supabase/migrations/003_context_blocks.sql` | `context_blocks` table + RLS | Phase 2 — PR-11 |
| `supabase/migrations/004_tasks.sql` | `tasks` table + RLS | Phase 2 — PR-12 |
| `supabase/migrations/005_persona_agent.sql` | `users.persona`, `users.is_agent`, `project_chat_messages`, `api_keys` | Phase 2 — PR-13 |

---

## New Environment Variables

| Variable | Required | Phase | Used in |
|----------|----------|-------|---------|
| `CRON_SECRET` | Yes | Phase 1 | `/api/cron/digest` auth |
| `RESEND_FROM` | Yes | Phase 1 | Email digest sender address |
| `ANTHROPIC_API_KEY` | Yes | Phase 2 | Task decomposition + project chat |

---

## Implementation Order

```
Step 0: Branch hygiene
Step 1: Auth fix — (app)/layout.tsx + SignOutButton → merge to main

Phase 1 (parallel where possible):
  Window A: PR-02 ProjectCard          → unblocks PR-03, PR-04, PR-08, PR-09
  Window B: PR-05 Vote+RaiseHand       → parallel (pure API)
  Window C: PR-06 Create/Edit Form     → parallel (pure API + page)
  Window D: PR-10 CoWork Sync          → parallel (independent)

  After PR-02 merges:
  Window E: PR-03 Discovery Board
  Window F: PR-04 Project Detail
  Window G: PR-07 User Profile

  After PR-03 + PR-05 + PR-06 merge:
  Window H: PR-08 Slack Wiring
  Window I: PR-09 Email Digest

Phase 2 (sequential):
  PR-11 Context Workbench
  PR-12 Plan Mode          (uses PR-11 context blocks as AI input)
  PR-13 Persona + Agent    (uses PR-11 context export as chat system prompt)
```

---

## Completion Criteria (Ralph Loop Done When)

1. ✅ Branch hygiene complete — `git branch -r` shows only `main` + 9 `feat/pr-*` branches
2. ✅ Auth fix merged to `main` — login → `/discover` works without 404 on Vercel
3. ✅ All Phase 1 PRs (02–10) merged to `main` — board, voting, profiles, Slack, email, CoWork all functional with real seeded data
4. ✅ All Phase 2 PRs (11–13) merged to `main` — context workbench, plan mode, persona UX, agent participation all functional
5. ✅ Every PR passes `npx tsc --noEmit` + `npm run lint` before merge
6. ✅ `main` deploys cleanly to Vercel at each merge

---

## Out of Scope

- Kernel-level agent behavioral firewall (infrastructure product)
- Air-gapped MCP / private VPC deployment (enterprise infra)
- Compliance-aware SDLC wrapper (regulated industry product)
- Multi-repo change orchestration (separate product)
- Mobile-first review interface (Phase 3 consideration)
- Agent-to-agent API contracts / software factory (future bet)
