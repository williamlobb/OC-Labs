# Research: Jira Sync Failures, Unassigned Flow, and Assignee Dropdown
**Date**: 2026-04-09 13:57 AEST
**Scope**: Investigated Plan board Jira sync behavior, assignee dropdown population, unassigned-task gating, and sync error UX.

## Key Findings
1. The `Sync to Jira` path is wired from the Plan page to `TaskBoard.handleSyncToJira()`, then to `POST /api/v1/projects/[id]/jira/sync`, where Epic and issue creation occur.
2. Jira sync currently hard-blocks when any unsynced task has no assignee (`400` with `Assign each unsynced task before Jira sync...`). This is server-enforced and not overridable.
3. The specific sync error shown in the screenshot (`customfield_10011 ... not on the appropriate screen`) originates from Epic creation payload in `createEpic()`, which always sends `customfield_10011`.
4. Sync status/error UI is a custom banner in `TaskBoard` that auto-dismisses after 5 seconds and cannot be manually dismissed (`pointer-events-none` + no close button), matching the reported readability issue.
5. Assignee dropdown options are sourced only from `project_members` fetched on initial server render. If that query returns no rows, users only see `Unassigned`.
6. A recent RBAC migration drops the old `project_members` `join` policy (which covered all actions) and replaces it with an `INSERT`-only policy. This likely removed `SELECT` access for authenticated users on `project_members`, which would explain empty assignee lists.
7. Assignment writes are additionally validated server-side: `assignee_id` must exist in `project_members` for the project. So if membership rows are not readable/available, assigning users fails by design.
8. Permission model mismatch is possible: power users can still edit project content (`canEdit`) even when they are not project members, meaning they can see edit controls but not selectable member options.

## Relevant Files
- `src/components/plan/TaskBoard.tsx`: Sync trigger, response handling, and transient sync banner UX.
- `src/components/plan/TaskCard.tsx`: Assignee dropdown rendering (`Unassigned` + `teamMembers`).
- `src/components/plan/TaskDetailModal.tsx`: Assignee dropdown in modal.
- `src/app/(app)/projects/[id]/plan/page.tsx`: `tasks` + `project_members` fetch and `teamMembers` mapping.
- `src/app/api/v1/projects/[id]/jira/sync/route.ts`: Sync endpoint, unassigned hard gate, issue/Epic sync loop.
- `src/lib/jira/client.ts`: Jira API client, error parsing, `createEpic()` payload with `customfield_10011`.
- `src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts`: Assignment validation requiring project membership.
- `src/lib/auth/permissions.ts`: `canEditProjectContent` power-user behavior.
- `supabase/migrations/20260408195700_rbac_tables.sql`: `project_members` policy change (drop old policy; insert-only replacement).
- `supabase/migrations/001_initial.sql`: Original `project_members` policy that previously covered reads/writes.
- `src/components/projects/RiskAssessmentButton.tsx`: Existing modal confirmation pattern suitable for “sync unassigned anyway?”.

## Patterns Observed
- Sync errors are passed through from backend strings with minimal translation for non-technical users.
- Epic creation is attempted in multiple places (`projects` create flow, discover chat flow, and sync flow fallback) with no schema negotiation for Jira custom fields.
- Membership-dependent UX is server-rendered once and not refreshed client-side, so stale/empty membership results persist until reload.
- Route signatures often include request objects that are currently unused (e.g., `_req` in Jira sync), leaving room for explicit override flags.

## Open Questions
1. Product behavior: Should unassigned unsynced tasks be allowed by default, or only via explicit user confirmation?
2. Jira compatibility: Should `customfield_10011` be optional behind env config (or retried without custom fields on 400 field errors)?
3. Membership model: Should power users be auto-added to project members for assignment, or should assignment options remain strictly membership-based?
4. RLS intent: Should authenticated users be allowed to `SELECT project_members` for projects they belong to (and/or that they can edit as power users)?

## Recommendations
1. Replace the hard unassigned sync block with a two-step flow:
- First call returns `400` with machine-readable code/details like `UNASSIGNED_TASKS` and a task preview.
- UI shows a confirmation dialog: “These tasks are unassigned. Continue anyway?”
- On confirm, re-call sync with an explicit override flag (e.g., `{ allowUnassigned: true }`).
2. Improve sync feedback UX:
- Make error/success banner persistent until manual dismiss.
- Add close button and pointer-enabled container.
- Translate known Jira errors into plain-language guidance (keep technical details collapsible or appended).
3. Fix `project_members` read path:
- Add/restore a `SELECT` policy on `project_members` compatible with current RBAC model.
- Validate that current user can read their own project member row and that `teamMembers` is populated in Plan page.
4. Harden Jira Epic creation:
- Avoid always sending `customfield_10011` unless configured/needed.
- On field-specific 400 errors, retry once with minimal payload (`project`, `issuetype`, `summary`) and surface a friendly message.
5. Add guardrails/checks:
- Validate and log failure on owner membership insert during project creation.
- Consider auto-membership normalization for owners/power users where assignment UX requires membership.

## Raw Agent Outputs
### Explorer A (Flow & Entry Points)
**Plan Board `Sync to Jira` flow**
1. Plan page mounts the board component and passes `projectId`/permissions into `TaskBoard`: [page.tsx:17](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx:17), [page.tsx:55](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx:55).
2. `Sync to Jira` button exists in `TaskBoard` and triggers `handleSyncToJira()` on click: [TaskBoard.tsx:195](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:195), [TaskBoard.tsx:284](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:284).
3. Client handler calls `POST /api/v1/projects/${projectId}/jira/sync`: [TaskBoard.tsx:202](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:202).
4. Route handler entrypoint is `POST` in sync route: [route.ts:84](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:84).
5. Sync route validates auth/permission/config, then loads project/tasks: [route.ts:91](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:91), [route.ts:94](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:94), [route.ts:99](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:99), [route.ts:104](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:104).
6. If project has no epic key, it creates one (`createEpic`) and persists it: [route.ts:52](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:52), [route.ts:63](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:63), [route.ts:69](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:69).
7. For each unsynced task, it creates Jira issue (`createIssue`) and stores mapping fields (`jira_issue_key/url/synced_at`): [route.ts:151](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:151), [route.ts:158](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:158), [route.ts:167](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:167).
8. `TaskBoard` shows created/skipped/failed summary from response: [TaskBoard.tsx:211](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:211), [TaskBoard.tsx:214](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:214).

**Where project/epic/ticket creation is called**
1. OC Labs project creation from UI form posts to `/api/v1/projects`: [ProjectForm.tsx:96](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/projects/ProjectForm.tsx:96), [ProjectForm.tsx:98](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/projects/ProjectForm.tsx:98).
2. `/api/v1/projects` inserts project row, then fire-and-forget Jira epic creation: [projects route.ts:41](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/route.ts:41), [projects route.ts:86](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/route.ts:86).
3. Discover chat path also creates OC Labs project and then Jira epic: [discover/chat route.ts:93](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:93), [discover/chat route.ts:105](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:105), [discover/chat route.ts:137](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:137).
4. Jira API wrappers:
- Epic creation function: [jira client.ts:157](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/jira/client.ts:157).
- Ticket creation function: [jira client.ts:77](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/jira/client.ts:77).
5. No Jira project provisioning call exists; all Jira issues/epics are created under configured `JIRA_PROJECT_KEY` (not created dynamically): [sync route.ts:135](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:135), [jira client.ts:162](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/jira/client.ts:162).

---

### Explorer B (Assignee Data Flow)
**Findings**

1. Assignee options are sourced only from `project_members` on initial server render.
- Query + mapping to `teamMembers`: [page.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx:26), [page.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx:49)
- Passed through to board/task UIs: [TaskBoard.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:332), [TaskBoard.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:362)
- Dropdown rendering (`Unassigned` + `teamMembers.map(...)`): [TaskCard.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskCard.tsx:213), [TaskCard.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskCard.tsx:214), [TaskDetailModal.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskDetailModal.tsx:230), [TaskDetailModal.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskDetailModal.tsx:231)

2. Why current user can be missing from the dropdown.
- `canEdit` can be true for power users even without project membership, so they can edit tasks but won’t appear in assignee options: [page.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx:41), [permissions.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/auth/permissions.ts:48)
- `project_members` RLS looks broken for reads: migration drops old `join` policy and adds only `FOR INSERT` policy, with no replacement `FOR SELECT` policy: [20260408195700_rbac_tables.sql](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/20260408195700_rbac_tables.sql:83), [20260408195700_rbac_tables.sql](/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/20260408195700_rbac_tables.sql:85). Since page uses anon+session client (RLS enforced): [server.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/supabase/server.ts:8), this can make members query return empty -> only `Unassigned`.
- Membership creation is attempted but not error-checked in key flows, so users/projects can exist without `project_members` rows: [projects/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/route.ts:61), [discover/chat/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/discover/chat/route.ts:123), [auth/callback/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/auth/callback/route.ts:107)
- `teamMembers` is not re-fetched client-side after mount, so recent membership changes won’t appear until reload: [TaskBoard.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:31), [TaskBoard.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:43)

3. Sync-readiness constraints tied to assignees.
- Assignment API enforces assignee must be a `project_members` row (`assignee_id is not a project member`): [tasks/[taskId]/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts:65), [tasks/[taskId]/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts:77)
- Jira sync blocks when any unsynced task is unassigned: [jira/sync/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:118), [jira/sync/route.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:129)
- No CoWork sync-readiness gating for assignee options (`cowork_synced_at` is only written/displayed, not used in member/task queries): [sync.ts](/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/cowork/sync.ts:37), [profile/me/page.tsx](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/profile/me/page.tsx:62)

---

### Explorer C (Toast/Error UX + Confirmation Pattern)
**Jira Sync toast/error UX**
1. Jira sync uses a custom in-component banner, not a toast library. Message state is `jiraSyncMessage` in [TaskBoard.tsx:48](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:48), rendered as a fixed bottom-right banner at [TaskBoard.tsx:371](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:371).
2. Duration is hardcoded to 5 seconds via `setTimeout(..., 5000)` at [TaskBoard.tsx:72](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:72), with cleanup at [TaskBoard.tsx:73](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:73).
3. Close behavior is auto-dismiss only; there is no close button. The wrapper is `pointer-events-none` at [TaskBoard.tsx:372](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:372), so users cannot click to dismiss.
4. Error text shown in this banner is set in `handleSyncToJira`: backend error passthrough/fallback at [TaskBoard.tsx:206](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:206), network fallback at [TaskBoard.tsx:218](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:218), and success/partial-failure summary at [TaskBoard.tsx:214](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:214).

**Unassigned gating (sync block)**
1. The hard gate is server-side in [jira sync route:118](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:118): it blocks when a task is both unsynced and unassigned.
2. Returned 400 error text is composed at [jira sync route:129](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:129) with a preview of up to 3 task titles from [jira sync route:122](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:122).
3. There is currently no “force/override” input for “sync unassigned anyway”; request body is unused (`_req`) at [jira sync route:85](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:85).
4. Additional gating: edit permission check at [jira sync route:94](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:94), and the Sync button only renders for `canEdit` at [TaskBoard.tsx:282](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:282), where `canEdit` is computed at [plan page:41](/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx:41).

**Reusable confirmation patterns for “sync unassigned anyway?”**
1. Best existing modal confirmation pattern: [RiskAssessmentButton.tsx:25](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/projects/RiskAssessmentButton.tsx:25) to [RiskAssessmentButton.tsx:75](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/projects/RiskAssessmentButton.tsx:75). It already does two-step confirm, backdrop close, explicit Cancel/Confirm actions, and post-confirm state.
2. Existing inline “danger confirm” pattern: [TaskDetailModal.tsx:362](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskDetailModal.tsx:362) to [TaskDetailModal.tsx:388](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskDetailModal.tsx:388). Good if you want confirmation inline in an existing panel, not a separate modal.
3. Lightweight fallback pattern: native browser confirm in [UpdatesFeed.tsx:86](/Users/williamlobb/Documents/Repos/OC-Labs/src/components/projects/UpdatesFeed.tsx:86). Fastest to implement, least control over styling/content.
