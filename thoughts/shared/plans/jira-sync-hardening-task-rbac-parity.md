# Jira Sync Hardening + Task RBAC Parity

## Scope
Implement regression fixes from `thoughts/shared/research/2026-04-10-0909-jira-sync-plan-regression-audit.md`.

Goals:
- Keep Jira epic linkage strict while preventing opaque sync failures
- Make Jira configuration clearer in UI
- Restore end-to-end task write parity for `power_user` and `tech_lead`

## Assumptions and Constraints
1. Epic linkage is strict. If issue type cannot be parented under epic, sync should fail clearly.
2. `tech_lead` should have task-write parity with `owner`, `contributor`, and `power_user`.
3. Integrations should show effective `JIRA_ISSUE_TYPE` as read-only.
4. Jira sync guard should allow only `Task` for MVP scope (do not broaden to `Story`/`Bug`).
5. Known env scope to update is local `.env.local` and Vercel project env vars.
6. No scope expansion to inbound Jira sync/webhooks/background jobs.
7. New migration must use timestamped filename.

## Phase 1: Jira Sync Contract and Error Semantics

### Files
- `src/app/api/v1/projects/[id]/jira/sync/route.ts`
- `src/lib/jira/client.ts`
- `src/test/unit/api/jira-sync-route.test.ts`
- `src/test/unit/lib/jira/client.test.ts`

### Changes
1. Add pre-flight compatibility guard for `JIRA_ISSUE_TYPE` when epic parent linkage is required.
2. Keep strict behavior: do not retry without `parent`.
3. Extend friendly error mapping for parent/issue-type conflict.
4. Refine Jira client error shape so route can deterministically detect parent-link conflict.
5. Preserve current unassigned confirmation flow and summary behavior.

### Verification
- Add route tests for:
  - fail-fast on parent-incompatible issue type
  - friendly conflict copy for Jira parent errors
  - unchanged auth and unassigned confirmation flow
- Add Jira client tests for:
  - parent payload behavior
  - conflict classification shape
  - no fallback that drops parent
- Run:
  - `npm run test -- src/test/unit/api/jira-sync-route.test.ts`
  - `npm run test -- src/test/unit/lib/jira/client.test.ts`
  - `npm run lint`
  - `npx tsc --noEmit`

## Phase 2: Config Visibility + Task Edit Discoverability

### Files
- `src/app/(app)/settings/integrations/page.tsx`
- `src/components/settings/IntegrationsPanel.tsx`
- `src/components/plan/TaskBoard.tsx`
- `src/components/plan/TaskCard.tsx`
- `src/components/plan/TaskDetailModal.tsx`
- `.env.local.example`
- `src/test/unit/components/IntegrationsPanel.test.tsx` (new)
- `src/test/unit/components/TaskBoard.test.tsx`
- `src/test/unit/components/TaskCard.test.tsx` (new)

### Changes
1. Pass `jiraIssueType` into Integrations panel and render it.
2. Show warning for incompatible issue type.
3. Document in `.env.local.example` that `JIRA_ISSUE_TYPE` must be child/task-level (not `Epic`).
4. Add explicit task-card affordance: `Open details` for all; `Edit` shortcut for `canEdit` users.
5. If needed, support opening task modal directly in edit state.
6. Keep delete action inside modal confirmation flow.

### Verification
- Add component tests for issue type display + warning copy
- Add/extend task board/card tests for discoverability and edit shortcut behavior
- Manual checks on settings integrations page and plan board personas
- Run:
  - `npm run test -- src/test/unit/components/TaskBoard.test.tsx`
  - `npm run test -- src/test/unit/components/IntegrationsPanel.test.tsx`
  - `npm run test -- src/test/unit/components/TaskCard.test.tsx`
  - `npm run lint`
  - `npx tsc --noEmit`

## Phase 3: API + RLS Parity for Task Writes

### Files
- `src/app/api/v1/projects/[id]/tasks/route.ts`
- `src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts`
- `supabase/migrations/<timestamp>_tasks_rbac_parity.sql` (new)
- `src/test/unit/api/tasks-route.test.ts` (new)
- `src/test/unit/api/task-item-route.test.ts` (new)

### Changes
1. Replace legacy `write tasks` `FOR ALL` policy with explicit `INSERT/UPDATE/DELETE` policies.
2. Match app RBAC in SQL:
   - allow `power_user`
   - allow project members in `owner|contributor|tech_lead`
   - deny `observer|interested`
3. Add proper `WITH CHECK` for insert/update project scope.
4. Map RLS permission-denied DB failures to `403` in both task routes.
5. Keep non-permission DB failures as `500`.

### Migration Strategy
1. Create timestamped migration dropping old task-write policy and adding granular policies.
2. Apply migration in staging first.
3. Deploy app changes to staging and verify.
4. Roll same sequence to production.

### Verification
- Add unit tests for task POST/PATCH/DELETE permissions and error mapping
- Manual persona matrix: owner, contributor, tech_lead, power_user(non-member), observer, interested
- Run:
  - `npm run test -- src/test/unit/api/tasks-route.test.ts`
  - `npm run test -- src/test/unit/api/task-item-route.test.ts`
  - `npm run lint`
  - `npx tsc --noEmit`

## Test Matrix
- Jira parent conflict handled with clear guidance and no orphan issue fallback
- Existing unassigned Jira flow unchanged
- Integrations UI shows issue type and warns when incompatible
- Task card edit flow discoverable
- Task write parity matches RBAC across API and RLS
- Permission-denied DB errors return `403` (not `500`)
- Lint and typecheck clean

## Rollout and Ops
1. Immediate mitigation: set `JIRA_ISSUE_TYPE` to child/task-level type in all envs.
2. Rollout order:
   - staging env update
   - staging migration
   - staging deploy + verification
   - production env update
   - production migration
   - production deploy + verification
3. Monitor:
   - Jira parent conflict errors
   - task route `403` rates after rollout

## Resolved Decisions
1. Jira guard policy is `Task` only for now.
2. Environment updates are required in local `.env.local` and Vercel project env vars (`JIRA_ISSUE_TYPE` currently `Epic`).
