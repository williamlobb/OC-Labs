# Research: Plan Board Jira Sync error (`projects.jira_epic_key`)
**Date**: 2026-04-09 13:29
**Scope**: Investigated the `/projects/[id]/plan` flow, `Sync to Jira` call chain, Supabase migrations/schema alignment, and likely causes of `column projects.jira_epic_key does not exist`.

## Key Findings
1. The error is most likely caused by schema drift in the connected database: code expects `projects.jira_epic_key`, but the active DB does not have that column.
2. The column is present in repo migration history (`supabase/migrations/010_project_jira_epic.sql`) and in app-level TS model (`src/types/index.ts`), so this is not a naming typo in code.
3. The exact failing path is the Plan board `Sync to Jira` action calling `POST /api/v1/projects/[id]/jira/sync`, where the route executes:
   - `supabase.from('projects').select('id, title, jira_epic_key').eq('id', id).single()`
4. The Plan page can render normally until sync is invoked; the surfaced red UI message matches the server route returning `projectError.message` directly.
5. The same missing-column condition can also impact project creation side-effects where async epic updates run against `projects.jira_epic_key`.

## Relevant Files
- `src/components/plan/TaskBoard.tsx` — Plan tab UI and `handleSyncToJira` trigger.
- `src/app/api/v1/projects/[id]/jira/sync/route.ts` — Sync endpoint selecting `jira_epic_key` and creating Jira issues.
- `src/lib/jira/client.ts` — Jira issue/epic client functions.
- `src/app/api/v1/projects/route.ts` — Project create flow asynchronously updating `jira_epic_key`.
- `src/app/api/v1/discover/chat/route.ts` — Alternate create flow also updating `jira_epic_key`.
- `src/lib/data/project-queries.ts` — Shared project fetch (`select('*')`) used by project layout/page.
- `supabase/migrations/001_initial.sql` — Original `projects` table definition (without `jira_epic_key`).
- `supabase/migrations/010_project_jira_epic.sql` — Adds `projects.jira_epic_key`.
- `src/types/index.ts` — App-level `Project` and `Task` typings.

## Patterns Observed
- Jira integration follows graceful degradation: if epic creation fails or epic key is null, task sync still attempts issue creation without parent epic.
- Supabase clients are currently untyped (`Database` generic not wired), so compile-time schema drift detection is weak.
- DB error messages are passed through to UI for sync failures, which helps diagnosis but also exposes raw backend details.

## Open Questions
1. Which Supabase project/environment is currently wired to `oclabs.space` and has migration `010_project_jira_epic.sql` been applied there?
2. Is there any deployment path that skipped migrations after Jira features were merged?
3. Should sync endpoint degrade when the epic column is absent (temporary compatibility guard), or should we enforce migration correctness and fail fast?
4. Do we want a backfill job for existing projects with `jira_epic_key IS NULL` once schema consistency is restored?

## Recommendations
1. Verify and apply `010_project_jira_epic.sql` to the production/active DB used by the failing environment.
2. Add a startup or health-check assertion for expected schema columns to catch missing migrations before user actions fail.
3. Generate and wire Supabase `Database` types to all clients (`server`, `client`, `admin`) for stronger compile-time alignment.
4. Optional hardening: in Jira sync route, catch missing-column database error and return an operator-friendly action message (e.g., “database migration required”) instead of raw SQL text.

## Raw Agent Outputs
### Agent: Entry-point map explorer
1) **Entry-point map**

- Auth gate for all project routes: [`middleware`]( /Users/williamlobb/Documents/Repos/OC-Labs/middleware.ts#L4 ) delegates to [`updateSession`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/lib/supabase/middleware.ts#L5 ), which redirects unauthenticated users to login.
- Project shell entry: [`ProjectLayout`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/layout.tsx#L19 ) renders [`ProjectTabs`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/projects/ProjectTabs.tsx#L18 ) for all `/projects/[id]/*` pages.
- Plan tab entry: `TABS` includes `Plan -> /plan` in [`ProjectTabs`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/projects/ProjectTabs.tsx#L7 ) and produces route `/projects/[id]/plan`.
- Plan page server entry: [`PlanPage`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx#L15 ) loads tasks/members, computes `canEdit`, then renders [`TaskBoard`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx#L52 ).
- Plan UI render entry: [`TaskBoard`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx#L43 ) renders kanban columns + [`TaskCard`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx#L335 ) + [`TaskDetailModal`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx#L366 ).
- Sync UI entry: `Sync to Jira` button in [`TaskBoard`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx#L277 ) triggers [`handleSyncToJira`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx#L189 ).

2) **File list (one-line purpose each)**

- [`src/app/(app)/projects/[id]/layout.tsx`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/layout.tsx#L19 ): project-level layout that injects tabs and wraps the Plan page.
- [`src/components/projects/ProjectTabs.tsx`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/projects/ProjectTabs.tsx#L7 ): defines tab routes, including Plan (`/plan`).
- [`src/app/(app)/projects/[id]/plan/page.tsx`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx#L15 ): server page for `/projects/[id]/plan`, fetches tasks/members and passes props to the board.
- [`src/components/plan/TaskBoard.tsx`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx#L43 ): main client Plan UI; owns task state, task mutations, decompose action, and Jira sync action.
- [`src/components/plan/TaskCard.tsx`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskCard.tsx#L33 ): per-task card UI for status/assignee/agent/dependency interactions.
- [`src/components/plan/TaskDetailModal.tsx`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskDetailModal.tsx#L31 ): task detail/edit modal; displays linked Jira issue key/url when present.
- [`src/app/api/v1/projects/[id]/jira/sync/route.ts`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts#L50 ): POST endpoint behind `Sync to Jira`, validates auth/config, creates Jira issues, writes mappings back to `tasks`.
- [`src/lib/jira/client.ts`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/lib/jira/client.ts#L77 ): Jira API client (`createIssue`) used by sync route.
- [`src/lib/auth/permissions.ts`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/lib/auth/permissions.ts#L37 ): `canEditProjectContent` authorization guard used by plan/task/sync API routes.
- [`src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts#L18 ): PATCH/DELETE handlers used by TaskBoard edit/status/assign/dependency/delete actions.
- [`src/app/api/v1/projects/[id]/plan/route.ts`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/plan/route.ts#L6 ): POST handler for “Decompose with AI” task generation.
- [`src/app/api/v1/projects/[id]/tasks/route.ts`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/route.ts#L12 ): GET/POST task collection endpoint (related Plan API surface).
- [`src/types/index.ts`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/types/index.ts#L114 ): `Task` model includes Jira mapping fields (`jira_issue_key`, `jira_issue_url`, `jira_synced_at`).
- [`src/app/api/v1/projects/route.ts`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/route.ts#L82 ): project-create flow that asynchronously seeds `projects.jira_epic_key`.
- [`src/app/api/v1/discover/chat/route.ts`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts#L131 ): alternate project-create flow that also seeds `jira_epic_key`.

3) **Suspected call chain for `Sync to Jira`**

1. User clicks button in Plan UI: [`TaskBoard` button `onClick={handleSyncToJira}`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx#L277 ).
2. Client action runs: [`handleSyncToJira`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx#L189 ) posts to `/api/v1/projects/${projectId}/jira/sync` and parses `{created, skipped, failed}`.
3. API route entry: [`POST` in sync route]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts#L50 ) checks user auth and [`canEditProjectContent`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts#L60 ).
4. Route validates Jira env config via [`hasRequiredJiraConfig`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts#L18 ), then loads project (`jira_epic_key`) + tasks ([`Promise.all`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts#L70 )).
5. For each task without `jira_issue_key` ([`if (task.jira_issue_key?.trim()) skipped`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts#L95 )):
6. Route calls [`createIssue`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts#L101 ) from [`lib/jira/client.ts`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/lib/jira/client.ts#L77 ), with summary/description/issue type and optional `epicKey`.
7. `createIssue` sends Jira REST `POST /rest/api/3/issue` ([`fetch`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/lib/jira/client.ts#L116 )) and returns `{key,url}`.
8. Sync route persists Jira mapping to `tasks` (`jira_issue_key`, `jira_issue_url`, `jira_synced_at`) ([update block]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts#L110 )).
9. Route returns summary payload ([`{ created, skipped, failed, errors }`]( /Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts#L134 )); client renders status message in TaskBoard ([message UI]( /Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx#L303 )).

---

### Agent: Error trace explorer
1) **Primary root-cause hypothesis with evidence**

The most likely root cause is: the DB backing this runtime is missing migration `010_project_jira_epic.sql`, so `public.projects.jira_epic_key` does not exist.

Evidence:
- `jira_epic_key` is added only in migration `010_project_jira_epic.sql`.
- The plan board render path itself does **not** select `jira_epic_key` (it uses `select('*')` or `select('title, summary')`).
- The plan board UI has a “Sync to Jira” action that calls `/api/v1/projects/[id]/jira/sync`, and that route explicitly selects `jira_epic_key` from `projects`; this is the most direct source of the exact error text `column projects.jira_epic_key does not exist`.

2) **Exact file:line references**

- Migration introducing column: [`supabase/migrations/010_project_jira_epic.sql:3`](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/010_project_jira_epic.sql:3)
- Initial schema without column: [`supabase/migrations/001_initial.sql:20`](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/001_initial.sql:20)

Plan board load/runtime path:
- Plan route component: [`src/app/(app)/projects/[id]/plan/page.tsx:15`](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx:15)
- Shared project layout (runs for `/projects/[id]/plan`): [`src/app/(app)/projects/[id]/layout.tsx:19`](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/layout.tsx:19)
- Shared project fetch used by layout/page (`select('*')`): [`src/lib/data/project-queries.ts:19`](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/data/project-queries.ts:19)

Where plan board hits `jira_epic_key`:
- Plan board Jira sync trigger: [`src/components/plan/TaskBoard.tsx:196`](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:196)
- Jira sync route explicit select including missing column: [`src/app/api/v1/projects/[id]/jira/sync/route.ts:71`](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:71)
- Route returns DB error message directly: [`src/app/api/v1/projects/[id]/jira/sync/route.ts:79`](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:79)

3) **Secondary hypotheses**

- Project creation path can also fail on missing column when async Jira epic update runs:
  - [`src/app/api/v1/projects/route.ts:90`](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/route.ts:90)
  - [`src/app/api/v1/discover/chat/route.ts:139`](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:139)
- Environment mismatch: app may point to a Supabase project that has not applied migration `010` even if local repo has it.

---

### Agent: Schema/type alignment explorer
1) **Schema/type status table**

| Check | Status | Evidence |
|---|---|---|
| `projects.jira_epic_key` exists in DB migrations | Yes | Added in [supabase/migrations/010_project_jira_epic.sql:4](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/010_project_jira_epic.sql:4) (`text`, nullable) |
| `jira_epic_key` exists in TS `Project` type | Yes | Present in [src/types/index.ts:58](/Users/williamlobb/Documents/Repos/OC-Labs/src/types/index.ts:58) as `jira_epic_key?: string` |
| Supabase generated DB `Database` types for `projects` | Not found in repo | Supabase clients are untyped (no `Database` generic) in [src/lib/supabase/server.ts:8](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/supabase/server.ts:8), [src/lib/supabase/client.ts:4](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/supabase/client.ts:4), [src/lib/supabase/admin.ts:5](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/supabase/admin.ts:5) |
| Naming drift (`jira_epic_id`, etc.) | None found | Repo-wide search found no `jira_epic_id`; code/migrations consistently use `jira_epic_key` (e.g. [src/app/api/v1/projects/route.ts:90](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/route.ts:90)) |
| Rollout behavior for missing epic key | Explicitly nullable/degraded | Jira sync route handles null key and proceeds without Epic link: [src/app/api/v1/projects/[id]/jira/sync/route.ts:85](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:85) |

2) **Missing migration or drift details**

- No missing migration for introducing `jira_epic_key`; it already exists.
- No evidence of historical name drift (`jira_epic_id` not present).
- Type drift exists on nullability:
  - DB: nullable `text`.
  - TS: `jira_epic_key?: string` (does not model `null` explicitly).
  - Runtime workaround appears via cast to `string | null` in sync route: [src/app/api/v1/projects/[id]/jira/sync/route.ts:87](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:87).
- No backfill migration/job for existing `projects` rows with `jira_epic_key IS NULL`; current flow only sets key asynchronously on create in [src/app/api/v1/projects/route.ts:86](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/route.ts:86) and [src/app/api/v1/discover/chat/route.ts:137](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:137).

3) **Recommended safe remediation path (research only)**

1. Generate and commit Supabase `Database` types, then type all Supabase clients with that generic to prevent silent schema drift.
2. Align TS model to DB nullability (`jira_epic_key?: string | null`, or equivalent DB-derived type usage).
3. Add a safe reconciliation path for old/null records (idempotent backfill job: select projects where `jira_epic_key is null`, create epic, update key; retry-friendly and rate-limited).
4. Keep `jira_epic_key` nullable for now (current async/degraded behavior depends on it), then consider stricter constraints only after backfill + reliable epic provisioning.
