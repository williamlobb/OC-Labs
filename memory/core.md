# OC Labs — Core Memory

> Maintained by /checkpoint. Only update for architectural decisions, resolved blockers, and project-wide conventions.

## What This Project Is

Internal project discovery and collaboration board for the Omnia Collective. Employees post projects, vote on ideas, raise hands to join, and log milestones. Next.js 15 App Router + Supabase + Tailwind, deployed to oclabs.space.

## Architecture Decisions

### ADR-001: @supabase/ssr (not auth-helpers-nextjs)
Use createServerClient from @supabase/ssr. Cookie handling is manual (get/set/remove). See src/lib/supabase/server.ts.

### ADR-002: No Google Fonts
System font stack via Tailwind font-sans. Avoids CORS issues in Vercel preview environments.

### ADR-003: CoWork is source of truth for identity
name, title, brand, profile_photo_url are read-only in OC Labs. Sync from CoWork via src/lib/cowork/client.ts.

### ADR-004: Next.js 15 App Router only
No Pages Router. No getServerSideProps. Read node_modules/next/dist/docs/ before writing any Next.js code.

### ADR-005: Route groups for layout separation
(auth) group: login/signup/callback, no nav shell
(board) group: authenticated views with nav shell
api/v1/: REST endpoints for client-side mutations

### ADR-006: Service role only for trusted server ops
supabaseAdmin (src/lib/supabase/admin.ts) only in Route Handlers that need to bypass RLS. Never in Server Components or client.

### ADR-007: Context blocks support auditable file attachments
Context blocks now support optional file attachments (any type, up to 20MB) stored in Supabase Storage bucket `context-block-attachments`, with metadata on `context_blocks` (`attachment_*` columns + `author_name`). Description/body remains required. Storage policies allow authenticated reads and owner/contributor writes scoped by project-id path prefix.

### ADR-008: Plan tasks are dependency-aware
`tasks.depends_on` is now used end-to-end. AI decomposition can propose dependency indices, plan creation maps those indices to real task IDs, and task updates enforce dependency validity (no self-dependency, same-project task IDs only). A task cannot be moved to `done` while any dependency is not `done`. Plan UI surfaces readiness and offers a "ready now only" filter.

### ADR-009: Jira sync is manual, one-way, and idempotent (MVP)
Plan tasks can be synced from OC Labs to Jira via `POST /api/v1/projects/[id]/jira/sync` (owner/contributor only). Unsynced tasks create Jira issues and persist mapping on `tasks` (`jira_issue_key`, `jira_issue_url`, `jira_synced_at`); already-synced tasks are skipped on retry. Scope is intentionally MVP: no inbound Jira webhooks, no dependency link sync, no background jobs.

### ADR-010: Jira Epics auto-created per project, tasks linked as children
When a new OC Labs project is created, `createEpic()` fires asynchronously (never blocks project creation) to create a Jira Epic with the project title in the configured Jira project (key from JIRA_PROJECT_KEY env var). Epic key is stored on `projects.jira_epic_key`. When tasks are synced, `createIssue()` accepts `epicKey` param and links via `parent: { key }` field (works for both team-managed and classic projects; deprecated `customfield_10014` not used). Fire-and-forget: if Jira is unavailable, tasks sync without Epic links (graceful degradation). Jira env var guard: Epic creation runs only if all four Jira env vars (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY) are present.

### ADR-011: Hand raises are owner-approved before joining the team
`project_members.role='interested'` is treated as a pending join request, not an approved team member. Project owners have a dedicated `/projects/[id]/hand-raises` review tab to approve requests; approval updates role from `interested` to `contributor`. Overview Team lists only approved roles (`owner`, `contributor`, `observer`), so pending requests do not appear as joined members.

## Stack

Framework: Next.js 15 App Router
Language: TypeScript (strict)
Styling: Tailwind CSS v4
Database: Supabase (PostgreSQL + RLS)
Auth: Supabase Auth — email/password + GitHub OAuth
Email: Resend (noreply@theoc.ai)
Notifications: Slack Incoming Webhooks
Deployment: Vercel (oclabs.space)

## Key File Map

src/lib/supabase/ — client.ts, server.ts, admin.ts, middleware.ts
src/lib/github/repo.ts — GitHub repo metadata fetcher + owner/repo URL fallback parser
src/lib/notifications/slack.ts — webhook helpers (notifyProjectUpdate, notifyMilestone, notifyNeedsHelp, dmOwnerRaisedHand)
src/lib/cowork/client.ts — profile sync (fetchCoWorkProfile)
src/lib/utils/avatar.ts — deterministic colour from userId
src/types/index.ts — all shared interfaces (Project, User, Vote, ProjectMember, etc.)
middleware.ts — session refresh + auth guard

## Database

Project ref: lmhntrqbxrzltppafjnu (ap-southeast-2)
Tables: users, projects, project_members, votes, updates, user_skills
Enums: project_status, member_role
RLS: enabled — 10 policies applied
Migration: supabase/migrations/001_initial.sql
Seed: supabase/seed.sql (7 projects, 8 users)

## External Services

Supabase: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
GitHub OAuth: App ID 3502799, callback https://oclabs.space/auth/callback/github, GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET
Resend: RESEND_API_KEY, RESEND_FROM=noreply@theoc.ai
Slack #omnia-projects: SLACK_WEBHOOK_PROJECTS
Slack #wins: SLACK_WEBHOOK_WINS
CoWork: COWORK_API_URL + COWORK_API_KEY (not yet live — client returns null gracefully)

## Branch Strategy

main: Production — protected
develop: Integration — all PRs target this
phase/1-mvp: Phase 1 umbrella
feat/pr-01-auth-shell-auth-shell through feat/pr-10-cowork-sync-cowork-sync: Individual feature branches (stub commits exist)

## Phase 1 PR Map

PR-01 feat/pr-01-auth-shell: Auth shell — login, signup, GitHub OAuth, session middleware (no deps) ✅ Done — merged to develop 2026-04-03
PR-02 feat/pr-02-project-card: ProjectCard component (needs PR-01)
PR-03 feat/pr-03-discovery-board: Discovery board — list, filter, search (needs PR-02)
PR-04 feat/pr-04-project-detail: Raise hand mechanic (needs PR-01)
PR-05 feat/pr-05-vote-raise-hand: Vote mechanic (needs PR-01)
PR-06 feat/pr-06-create-edit-form: ProfileCard component (needs PR-01)
PR-07 feat/pr-07-user-profile: My profile view (needs PR-06)
PR-08 feat/pr-08-slack-wiring: GitHub repo link + README preview (needs PR-02)
PR-09 feat/pr-09-email-digest: Project registration form (needs PR-02)
PR-10 feat/pr-10-cowork-sync: Needs-help flag + Slack notification (needs PR-09)

## Build and Test Commands

npm run dev        — local dev server
npm run build      — production build (run before PR)
npm run lint       — ESLint
npx tsc --noEmit   — type check

## Auth Conventions (established PR-01)

- Server Actions for email/password auth (loginAction, signupAction) — no 'use client' on page
- GitHub OAuth via GitHubButton client component only — browser-only API
- isSafeRedirect() in src/lib/utils/is-safe-redirect.ts — URL-constructor guard, use everywhere a redirect target comes from user input
- upsertUser() in src/lib/auth/upsert-user.ts — uses supabaseAdmin; public.users has no INSERT RLS policy
- Auth callback route: src/app/auth/callback/route.ts — handles all PKCE code exchanges (GitHub + email)
- Route group is (app) not (board) — CLAUDE.md has a stale (board) reference, ignore it
- Next.js version is 16.2.2 (memory/docs say 15 — same patterns apply)

## Test Infrastructure (added PR-01)

- vitest + @testing-library/react + msw + playwright — in package.json devDeps, not yet installed
- Run `npm install` before `npm test`
- Test files: src/test/unit/ (107 specs) + src/test/e2e/ (16 specs)
- isSafeRedirect test file imports from @/lib/utils/isSafeRedirect (camelCase) — actual file is is-safe-redirect.ts (kebab); fix import when running tests

## Known Gotchas

- cookies() from next/headers is async in Next.js 15/16 — must await cookies()
- AGENTS.md enforces reading node_modules/next/dist/docs/ — directory does not exist in this repo; skip that step
- Context attachment uploads require Supabase migration `009_context_block_attachments.sql`; if the bucket `context-block-attachments` is missing, API calls return “Bucket not found”
- CoWork API not yet live — fetchCoWorkProfile() returns null gracefully when creds missing
- .env.local exists (created by CoWork). npm run build requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY
- Slack webhook URLs must NOT be committed to memory/core.md — GitHub secret scanning blocks push. Reference env var names only.
- middleware.ts exempts /signup and /login and /auth/* — all other routes require auth
- `thoughts/shared/logs/events.jsonl` is local telemetry; keep it git-ignored and untracked to avoid branch noise
