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

### ADR-012: Project chat is not DB-persisted; history is browser-local per project
Project chat messages are not persisted to `project_chat_messages` (table remains reserved for future audit). Runtime state is still owned by React, but the panel now restores/saves recent chat history in browser localStorage (keyed per `projectId`, capped to recent messages) for continuity across reloads/tab switches. Durable project record still comes from context blocks, updates, and tasks — not chat turns.

### ADR-013: Agent eagerness gated by tool description
The Go agent's `get_project_context` tool has a reactive description (not imperative "always call first"). System prompt says "fetch only when user's request requires it." This prevents verbose context dumps on every greeting while preserving proactive fetching when needed (e.g., "what's the status?"). See `agent/tools_project.go:13` and `agent/main.go:45`.

### ADR-015: Page-scoped agents use inline Anthropic SDK routes, not the Go agent
The Discover page has a creation-only assistant at `POST /api/v1/discover/chat`. It uses the Anthropic SDK directly (Haiku 4.5, Node.js runtime, 60s timeout) with a system prompt that hard-codes guardrails: any off-topic request (existing projects, profile, settings, voting) is redirected, not answered. Tool use is single-purpose (`create_project`) and replicates the same DB writes + Slack/Jira fire-and-forget as `/api/v1/projects`. The Go agent at AGENT_URL is reserved for project-page chat only. New page-scoped agents should follow this inline SDK pattern — lean, typed, no agent harness overhead.

### ADR-014: Contributor attribution via `author_name` column
`updates`, `context_blocks`, and `tasks` tables track who created them with `author_id` + `author_name` (string). For agent-authored items, `author_name = 'Omnia Agent'`. UI shows subtle avatar chip (initials in colour circle for humans, sparkle icon for agent) inline with the creation date. Ref: `src/components/ui/ContributorChip.tsx`.

### ADR-016: RBAC uses two layers with centralized permission helpers
Authorization is split into platform and project scope: `users.platform_role` (`user` or `power_user`) and `project_members.role` (includes `tech_lead`). Route handlers now call `src/lib/auth/permissions.ts` (`canCreateProject`, `canEditProjectContent`, `canEditProjectSettings`, `canManageMembers`, `canDeleteProject`) instead of ad-hoc inline checks. Project creation is power-user only; content edits allow `owner`, `contributor`, and `tech_lead`.

### ADR-017: Role invitations are email-token based and applied at auth time
Role assignment is managed via `role_invitations` + invitation tokens: power users create invites from `/api/v1/admin/invitations`, recipients accept via `/api/v1/invitations/[token]/accept`, and auth callback (`/auth/callback`) applies pending invitations by email on login. Invite email delivery uses `src/lib/email/invite.ts` (Resend). RLS/migration hardening prevents self-escalation by locking `users.platform_role` changes to trusted server paths.

### ADR-018: Agent repo context now includes linked repos and file discovery
`GET /api/v1/projects/[id]/context` now returns `project.github_repos` (plus `notion_url`), so `get_project_context` gives the model the same linked repos shown in the UI. The Go agent now includes linked repos in its system prompt and has a `list_repo_files` tool (in addition to `read_repo_file`) for repository path discovery during planning/context work. Repo parsing accepts both full GitHub URLs and `owner/repo` shorthand.

### ADR-019: Project chat is bounded for reliability under repo-analysis load
After repo-discovery tooling was added, project chat could exceed model input/token-rate limits and fail after long waits. Guardrails are now enforced in both Next and agent layers: project chat route normalizes+trims history, parses chunked Supabase auth cookies robustly, and applies a 45s upstream fetch timeout with clearer error propagation to UI. Go agent execution is capped (50s request context, 6 tool iterations, lower max output tokens per model call), and repo tool payloads are constrained (default file-list limit 80, max 200; file read truncation at 3500 chars). System prompt now instructs shallow repo inspection first (<=3 files) before deep scans.

### ADR-020: Project chat now normalizes platform errors and routes repo-read prompts to Sonnet 4.5
Project chat no longer surfaces raw upstream platform errors (e.g. `FUNCTION_INVOCATION_TIMEOUT`) directly to users. Both the Next.js project chat route and client-side error parser now map timeout/unavailable signatures to friendly guidance. The Go agent now uses intent-based model routing: repo/codebase-reading prompts default to `claude-sonnet-4-5`, general chat defaults to `claude-sonnet-4-6`, and invalid-model failures fall back to the general model. Routing can be overridden with `AGENT_MODEL_GENERAL` and `AGENT_MODEL_REPO_READ`.

### ADR-021: Project chat timeout budgets and repo tooling are tuned for reliability
Project chat route timeout budget is intentionally higher than agent runtime (`maxDuration=90s`, upstream fetch timeout `55s`, agent run timeout `52s`) so timeout handling is deterministic and user-facing errors remain friendly. Agent tool HTTP calls now share a bounded timeout client (`12s`) and GitHub repo tree reads are cached in-memory for short windows (`2m`) to reduce repeated recursive tree fetch cost. Prompt guidance also treats explicit plan confirmation as execution intent (create tasks immediately, avoid re-running repo discovery unless asked).

### ADR-022: Invitation onboarding supports GitHub sign-in and invite-scoped password signup
Invite links now preserve redirect intent through login (`redirectTo`) and expose two valid paths: GitHub OAuth or creating an email/password account. Public self-signup remains disabled; `/signup` is only accessible with a valid invitation redirect context. Signup action verifies invitation token validity, pending status, and strict email match before creating credentials, then redirects back into invitation acceptance flow.

### ADR-023: Invite accept route is idempotent to handle callback pre-application
The auth callback (`/auth/callback`) applies all pending role invitations by email for every auth event — this is required so GitHub OAuth users (who never visit the accept route) receive their roles. A side-effect is that email-confirmation signup and GitHub OAuth users arrive at `/api/v1/invitations/[token]/accept` with `accepted_at` already set. The accept route now treats this as an idempotent success: if `accepted_at !== null` and the current user's email matches the invitation, it redirects to the correct success destination (`/projects/[id]?success=role_applied` or `/discover?success=role_applied`). Unknown tokens and email mismatches on already-accepted invites still return `invalid_invitation`. Committed `134ad25`, verified in production 2026-04-09.

### ADR-024: Legacy `/admin` page removed; power-user admin is split under `/settings`
The monolithic `/admin` page is retired. Power-user administration now lives in dedicated settings routes: `/settings/roles` for platform role management and `/settings/project-assignments` for invite/member assignment workflows. Shared admin panels are still reused, but page-level headings/intro copy now own section titles to avoid duplicate headings.

### ADR-025: Power users have owner-equivalent project workflow controls in UI and agent context
Server-side permissions already allowed `power_user` edits, but project UI gates were still membership-only in several surfaces. The UI is now aligned with backend RBAC: power users can edit Context/Plan, post updates, access hand-raise management UI, see owner-level project controls, and open project chat even when not explicit project members. Project chat agent payloads also treat power users as owner-equivalent (`is_owner=true`) for planning/execution behaviors. Ref commit on `main`: `e5feb51` (2026-04-09).

### ADR-026: Update/context edits and deletes are author-owned (with RLS enforcement)
Project updates and context blocks now follow strict ownership for mutation: users can edit/delete only rows they authored; they cannot modify or remove other members' content. This applies consistently in API handlers and UI controls (Edit/Delete actions render only for self-authored items). Database RLS now enforces the same rule as a backstop (`update own`/`delete own` policies on `updates` and `context_blocks`) while insert permissions remain project-role based. Ref commit on `main`: `c74c8a6` (2026-04-09); migration `supabase/migrations/012_author_owned_content_mutations.sql` applied to linked remote.

### ADR-027: Jira sync now guarantees epic linkage and requires assignees
Task sync to Jira (`POST /api/v1/projects/[id]/jira/sync`) now enforces that every unsynced task has an `assignee_id` before pushing; otherwise it fails fast with a clear 400 error listing unassigned tasks. The same route now auto-creates and persists `projects.jira_epic_key` when missing (using `createEpic` + `supabaseAdmin` update) before creating child issues, so legacy projects still sync under a single project epic. Plan UI feedback for sync outcomes is now a temporary bottom-right toast (auto-dismiss ~5s) instead of persistent inline text. Ref commit on `main`: `109567b` (2026-04-09).

### ADR-028: Project chat failures auto-reset session state and expose manual reset control
Project chat now treats timeout/unavailable responses as session-break conditions instead of normal history turns. On these failures, browser-local chat persistence is cleared (failed threads do not survive refresh), the next send auto-starts with empty history, and the composer includes a persistent, low-noise `New chat` button (bottom-left in the prompt bar) for explicit resets at any time. Timeout/unavailable detection and friendly copy are centralized in `src/lib/chat/errors.ts` and reused by both route and client handlers. Ref commit on `main`: `e6d6e38` (2026-04-09).

### ADR-029: Hand-raise requests are idempotent, reviewer-scoped, and notify only once per user/project
`POST /api/v1/projects/[id]/raise-hand` is now idempotent "request join" (no toggle). `DELETE /api/v1/projects/[id]/raise-hand` explicitly withdraws a pending request. Repeat presses while already interested do not create duplicate requests. Owner Slack notification is persisted as one-time per `(project_id, user_id)` via `project_hand_raise_notifications`; re-raise after withdraw does not emit a second notification. Hand-raise review visibility is scoped to project owner and project `tech_lead`; reviewers can approve with role assignment (`contributor`, `observer`, `tech_lead`) or deny. Hand-raise Slack routing is private-only via `SLACK_WEBHOOK_HAND_RAISES` (no fallback to `SLACK_WEBHOOK_PROJECTS`).

### E2E Verification: Full invite flow confirmed in production (2026-04-09)
Live end-to-end test run on https://oclabs.space confirmed the complete invite flow works correctly:
1. Power user (williamlobb) sends invite from `/admin` → "Invite Platform Role" modal → email delivered via Resend from `noreply@oclabs.space` in <5 seconds.
2. Email mismatch guard fires correctly: clicking invite link while logged in as a different user redirects to `/discover?error=invitation_email_mismatch`.
3. Unauthenticated flow: clicking invite link redirects to `/login?redirectTo=/api/v1/invitations/[token]/accept`. Login page shows "Need an account? Create one with this invite" when a valid invite `redirectTo` is detected.
4. Signup: `/signup` page loads with "Use your invitation email to finish joining OC Labs", accepts name/email/password, creates account and chains through invite acceptance.
5. On success: user lands on `/discover` as a `User` role — CTA shows "Have an idea?" (not "New project"), confirming role was applied correctly.
No issues found. All security guards (email match, role gating, one-time token) behaved as designed.

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
- Use `React.cache()` wrappers in `src/lib/data/project-queries.ts` for shared per-request queries (user, project, membership, vote). Layout and child pages call the same cached function; only one DB round-trip fires per render. Add new cached fetchers here, not inline in page files.
