# Research: Jira Sync Intent Verification + Plan-Card Regression Audit
**Date**: 2026-04-10 09:09 AEST
**Scope**: Verified Jira sync behavior against intended design, traced current parent/issue-type failure, reviewed error UX clarity, and audited owner/power_user plan-card edit/delete parity across UI, API auth, and RLS.

## Key Findings
1. **Primary Jira failure is configuration + logic interaction, not the previous Epic-name-field bug.**
- Sync route takes `JIRA_ISSUE_TYPE` from env and passes it into issue creation: `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:222`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:257`.
- Local env currently sets `JIRA_ISSUE_TYPE=Epic`: `/Users/williamlobb/Documents/Repos/OC-Labs/.env.local:26`.
- Route also always passes `epicKey` when present: `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:258`.
- `createIssue()` always sets `fields.parent` when `epicKey` exists: `/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/jira/client.ts:175`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/jira/client.ts:177`.
- This matches reported Jira error: "Issue type ... cannot have parent but a parent is specified." (issue type chosen is incompatible with parent linkage in this project config).

2. **Intended behavior and current behavior diverge on issue-type compatibility checks.**
- Intended by example/default is task-level issue creation (`Task`), not creating child Epic issues: `/Users/williamlobb/Documents/Repos/OC-Labs/.env.local.example:31`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/jira/client.ts:162`.
- Current behavior does no guard/fallback when issue type cannot accept `parent`; it sends payload once and fails per task.

3. **Latest Jira UX improvements landed, but this parent/issue-type error is still under-translated.**
- Good: unassigned flow has explicit confirmation modal (409 -> confirm -> retry with `{ allowUnassigned: true }`): `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:247`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:241`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/JiraSyncConfirmModal.tsx:89`.
- Good: sync feedback is persistent until dismiss and supports technical details: `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:403`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:423`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:431`.
- Gap: mapper does not recognize parent/issue-type conflict; falls to generic "unexpected issue": `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:39`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts:87`.

4. **Owner/power_user parity for plan-card edit/delete is not end-to-end.**
- UI parity exists: `canEdit` includes power users and enables edit/delete controls: `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx:41`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskDetailModal.tsx:156`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskDetailModal.tsx:362`.
- API parity exists: task `PATCH`/`DELETE` call `canEditProjectContent` (power user allowed): `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts:28`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts:183`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/auth/permissions.ts:55`.
- **RLS parity is broken**: tasks write policy allows only project members `owner|contributor`; no power_user branch: `/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/006_tasks.sql:20`, `/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/006_tasks.sql:26`.
- Net effect: power_user can see controls and pass route guard but DB may reject writes; route returns generic 500 on DB errors: `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts:168`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts:194`.

5. **Plan-card edit/delete workflow exists but discoverability is weak.**
- Card click opens modal (`onInspect`), then edit/delete are inside modal only: `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskCard.tsx:83`, `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx:496`.
- This likely explains "no clear full edit/delete workflow" feedback even when functionality exists.

6. **Current tests pass but miss exactly these regressions.**
- Verified passing tests for current Jira UX/client route suite:
  - `src/test/unit/lib/jira/client.test.ts`
  - `src/test/unit/api/jira-sync-route.test.ts`
  - `src/test/unit/components/TaskBoard.test.tsx`
- Missing tests for parent/issue-type conflict mapping and task edit/delete parity under RLS (no unit API tests for `tasks/[taskId]` routes): `/Users/williamlobb/Documents/Repos/OC-Labs/src/test/unit/api`.

## Intended vs Actual (By Research Goal)
1. **Intended Jira sync behavior vs current**
- Intended: create task-level issues linked to project epic; surface plain-language outcomes.
- Actual: if `JIRA_ISSUE_TYPE` is parent-incompatible (current local: `Epic`), sync returns partial-failure summary with generic copy and technical detail dump.

2. **Why issue type + parent conflict still occurs after fixes**
- Recent fixes targeted epic custom-field compatibility (`createEpic` fallback), not issue creation parent compatibility.
- New conflict path is in `createIssue` payload semantics (`issuetype` + unconditional `parent`).

3. **Error messaging understandability and UX intent**
- Banner UX structure is improved and mostly aligned.
- Specific parent conflict message is not translated to actionable language (still opaque for non-Jira users).

4. **Owner/power_user parity for edit/delete (UI + API + permissions + RLS)**
- UI: parity yes.
- API auth helper: parity yes.
- RLS: parity no (critical mismatch), causing latent regressions.

5. **Gaps between intended and actual with concrete fixes**
- Gap A: env/config can silently set incompatible issue type.
- Gap B: parent-link logic lacks compatibility guard/fallback.
- Gap C: friendly error mapping lacks parent conflict case.
- Gap D: permission model parity breaks at DB policy layer.
- Gap E: edit/delete flow discoverability is low on task cards.

## Root-Cause Hypotheses (Ranked)
1. **`JIRA_ISSUE_TYPE=Epic` in runtime env causes parent conflict when `parent` is sent** — Confidence **0.96**.
2. **Issue creation always sets `parent` when epic key exists, without checking issue-type compatibility** — Confidence **0.90**.
3. **RLS tasks policy not updated to RBAC parity; power_user writes fail despite UI/API allow** — Confidence **0.90**.
4. **Error mapper lacks parent-conflict pattern, so users receive generic message** — Confidence **0.84**.
5. **Plan-card edit/delete is present but hidden behind inspect modal, creating perceived workflow gap** — Confidence **0.74**.

## Relevant Files
- `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/jira/sync/route.ts`
- `/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/jira/client.ts`
- `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskBoard.tsx`
- `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/JiraSyncConfirmModal.tsx`
- `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskCard.tsx`
- `/Users/williamlobb/Documents/Repos/OC-Labs/src/components/plan/TaskDetailModal.tsx`
- `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/(app)/projects/[id]/plan/page.tsx`
- `/Users/williamlobb/Documents/Repos/OC-Labs/src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts`
- `/Users/williamlobb/Documents/Repos/OC-Labs/src/lib/auth/permissions.ts`
- `/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/006_tasks.sql`
- `/Users/williamlobb/Documents/Repos/OC-Labs/supabase/migrations/20260408195700_rbac_tables.sql`
- `/Users/williamlobb/Documents/Repos/OC-Labs/.env.local`
- `/Users/williamlobb/Documents/Repos/OC-Labs/.env.local.example`

## Patterns Observed
- Env-driven Jira behavior has no runtime visibility in Integrations UI (project key shown, issue type not shown).
- Permissions are split across UI helper logic and DB RLS, and are currently inconsistent for tasks.
- UX layer now supports progressive disclosure (friendly text + technical details), but mapper coverage is incomplete.

## Recommended Next Implementation Sequence
1. **Immediate ops fix**: set `JIRA_ISSUE_TYPE` to a parent-compatible task-level type (likely `Task` as baseline), redeploy, and verify one known-failing task sync.
2. **Backend guard** (`jira/sync/route.ts` + `jira/client.ts`):
- Add explicit compatibility handling for `issuetype + parent`.
- If Jira returns parent incompatibility, retry once without parent (or fail with clear guidance, depending on product intent for epic linkage strictness).
3. **Friendly copy update** (`toFriendlyJiraMessage`): map parent/issue-type conflict strings to clear action text (example: "Current Jira issue type cannot be linked under an epic. Ask admin to set issue type to Task/Story.").
4. **RLS parity migration** (`supabase/migrations/NNN_tasks_rbac_parity.sql`): replace `write tasks` policy with granular INSERT/UPDATE/DELETE matching `canEditProjectContent` semantics, including `power_user` and `tech_lead` if intended.
5. **Task route error mapping** (`tasks/[taskId]/route.ts`): detect permission-denied DB failures and return `403` instead of `500`.
6. **Plan-card UX clarity** (`TaskCard.tsx`): add explicit affordance text/icon (e.g., "Open details") or kebab menu with Edit/Delete entry points for owners/power_users.

## Recommended Test Checks
1. **Unit: Jira sync route**
- Case: Jira returns parent/issue-type conflict; assert user-facing mapped guidance + technical details retained.
- Case: environment issue type is incompatible; assert deterministic API response.
2. **Unit: Jira client**
- Case: create issue with epicKey and incompatible type response; assert fallback or precise error contract (based on chosen behavior).
3. **Unit: Tasks API routes**
- Add new `tasks/[taskId]` route tests for owner and power_user edit/delete paths and forbidden paths.
- Assert `403` mapping on simulated permission-denied database errors.
4. **Integration/RLS validation (manual or scripted)**
- Persona matrix: owner, power_user(non-member), contributor, observer.
- Verify UI controls, API responses, and actual DB writes are aligned.
5. **UI regression**
- TaskBoard/TaskCard tests for explicit edit/delete discoverability affordance.

## Open Questions
1. Should epic linkage be **strict** (fail sync if parent cannot be set) or **best-effort** (create issue without parent and warn)?

Strict - there should always be a project epic that a task is attached to - and it auto creates already right - so based on which task the project is created in on oclabs, it should always find or create a new epic/project regardless
2. For plan-card edits, should `tech_lead` parity match `owner/power_user` in RLS and UI?

Yes that's correct. Tech should also be able to edit all those because that probably probably be overseeing those task cards the most anyway considering the quad technical.
3. Should Integrations panel expose effective `JIRA_ISSUE_TYPE` read-only to make misconfig obvious?

Show more information to the user the better

## Raw Agent Outputs
### Explorer: File map + entry points
- Mapped end-to-end Jira sync and plan-card edit/delete entry points across UI, API routes, permissions helpers, middleware, and migrations.
- Key paths: plan page, `TaskBoard`, `JiraSyncConfirmModal`, Jira sync route/client, task mutation route, tasks RLS migration.

### Explorer: Jira bug trace
- Confirmed route builds issue payload from env-driven issue type and epic parent linkage.
- Found local env issue type set to `Epic` while example expects `Task`.
- Confirmed mapper gap for parent/issue-type conflicts; current UX falls back to generic text + technical details.

### Explorer: owner/power_user parity
- UI/API helper parity implemented.
- RLS parity broken at `tasks` policy (`owner|contributor` only), causing potential power_user write failures.
- Recommended migration + 403 mapping + regression tests.
