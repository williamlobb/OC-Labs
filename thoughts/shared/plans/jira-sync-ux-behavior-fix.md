# Implementation Plan: Jira Sync UX + Behavior Fix

**Date:** 2026-04-09  
**Task:** Fix Jira sync UX and behavior using research artifact `thoughts/shared/research/2026-04-09-1357-jira-sync-assignee-ux.md`  
**Planning inputs read:** `CLAUDE.md`, `memory/core.md`, research artifact above  
**Scope:** Planning only (no code changes in this phase)

## Goals

1. Replace the hard unassigned-task block with an explicit confirmation gate (not a silent bypass, not a hard stop).
2. Make Jira sync feedback persistent until manually dismissed.
3. Translate Jira sync feedback into layperson-friendly messages while preserving technical details for troubleshooting.
4. Restore `project_members` read behavior (RLS) so assignee options populate reliably.
5. Harden Jira Epic creation so field-specific configuration issues do not break sync unexpectedly.

## Non-Goals

1. No inbound Jira webhook sync.
2. No background job/queue architecture changes.
3. No RBAC model redesign beyond the targeted `project_members` read-policy fix.

## Phase 1: Backend Sync Contract for Confirmation Gate

### Files

1. `src/app/api/v1/projects/[id]/jira/sync/route.ts`
2. `src/lib/jira/client.ts` (consumed by route; error-shaping alignment)
3. `src/types/index.ts` (optional: shared response typing if adopted)

### Concrete changes

1. Parse request body in sync route (`allowUnassigned?: boolean`) instead of ignoring request payload.
2. Replace the current hard 400 path for unassigned unsynced tasks with a structured confirmation-needed response when `allowUnassigned` is false.
3. Return machine-readable metadata for UI branching, e.g.:
   - `code: "UNASSIGNED_TASKS_CONFIRMATION_REQUIRED"`
   - `message` (layperson-friendly)
   - `unassignedTaskCount`
   - `unassignedTaskPreview` (first N task titles)
4. Keep backward compatibility for existing clients by continuing to include a string `error` field.
5. On confirm path (`allowUnassigned: true`), proceed with sync and include a `warning` field in response when unassigned tasks were intentionally included.
6. Normalize known Jira failure strings into user-friendly sync messages before returning route errors.

### Behavior-specific test/lint requirements

1. Add `src/test/unit/api/jira-sync-route.test.ts`:
   - Returns confirmation-required code when unassigned tasks exist and override is absent.
   - Proceeds when `allowUnassigned: true` is provided.
   - Preserves auth/permission guard behavior (401/403).
   - Returns user-friendly error text for known Jira field/screen failures.
2. Run: `npm run test -- src/test/unit/api/jira-sync-route.test.ts`
3. Run: `npm run lint`

## Phase 2: Jira Client Hardening for Epic Field Compatibility

### Files

1. `src/lib/jira/client.ts`
2. `.env.local.example` (only if introducing optional env-driven field config)

### Concrete changes

1. Stop hardcoding `customfield_10011` as always-on in `createEpic()`.
2. Use minimal Epic payload by default (`project`, `issuetype`, `summary`).
3. If optional custom Epic-name field support is kept, make it opt-in and conditionally included (not mandatory).
4. Add one retry path for field-specific 400 errors: retry Epic creation once without optional custom fields.
5. Ensure thrown errors remain actionable but do not leak raw Jira jargon to end users by default.

### Behavior-specific test/lint requirements

1. Add `src/test/unit/lib/jira/client.test.ts`:
   - Default Epic payload excludes optional custom field.
   - Optional custom field is included only when configured.
   - Field-specific 400 triggers single fallback retry without optional field.
2. Run: `npm run test -- src/test/unit/lib/jira/client.test.ts`
3. Run: `npm run lint`

## Phase 3: Plan UI Flow — Explicit Confirmation + Persistent Feedback

### Files

1. `src/components/plan/TaskBoard.tsx`
2. `src/components/plan/JiraSyncConfirmModal.tsx` (new; extracted confirmation UI)
3. `src/components/plan/TaskCard.tsx` (optional: copy-only hint if member list empty)
4. `src/components/plan/TaskDetailModal.tsx` (optional: same empty-member hint in modal)

### Concrete changes

1. Replace transient auto-dismiss sync banner with a persistent, dismissible message panel.
2. Remove the 5-second timeout auto-clear behavior.
3. Add a close button and pointer-enabled container so users explicitly dismiss feedback.
4. Introduce a confirmation modal when backend returns `UNASSIGNED_TASKS_CONFIRMATION_REQUIRED`:
   - Plain-language explanation of what “unassigned” means.
   - Task preview and count.
   - `Cancel` and `Sync anyway` actions.
5. On `Sync anyway`, re-submit with `{ allowUnassigned: true }`.
6. Keep feedback copy non-technical first, with optional technical details disclosure for advanced troubleshooting.
7. Use existing visual language/patterns (similar structure to `RiskAssessmentButton` modal) without introducing new design-system dependencies.

### Behavior-specific test/lint requirements

1. Extend `src/test/unit/components/TaskBoard.test.tsx`:
   - Confirmation modal appears for confirmation-required response.
   - Confirm action performs second API request with override flag.
   - Success/error feedback persists until manual dismiss.
   - Dismiss action removes feedback panel.
2. If extracted modal component, add `src/test/unit/components/JiraSyncConfirmModal.test.tsx` for interaction/accessibility checks.
3. Run: `npm run test -- src/test/unit/components/TaskBoard.test.tsx`
4. Run: `npm run lint`

## Phase 4: RLS Migration Strategy for `project_members` Read Fix

### Files

1. `supabase/migrations/013_project_members_select_policy.sql` (new)
2. `src/app/(app)/projects/[id]/plan/page.tsx` (verify/select error handling path if needed)

### Concrete changes

1. Add an explicit `FOR SELECT` policy on `public.project_members` so assignee option queries work again under RLS.
2. Policy intent: authenticated users can read project member rows when they are:
   - a member of that same project, or
   - the project owner, or
   - a power user.
3. Keep current insert/manage policy unchanged (`join or manage members`).
4. Use an idempotent migration style (`DROP POLICY IF EXISTS ...` before create) for safe re-apply.
5. If policy logic needs membership lookups on the same table, implement via a security-definer helper function to avoid recursive RLS checks.

### Migration rollout order

1. Apply DB migration first in staging.
2. Verify Plan page assignee options populate for owner, contributor, and power_user personas.
3. Verify assignment PATCH no longer fails due to invisible membership rows.
4. Promote migration to production before frontend/backend deploy (or same deploy window with migration first).

### Rollback plan

1. Keep migration reversible with explicit policy name.
2. Emergency rollback: drop new select policy and re-apply previous safe fallback policy.
3. If rollback is required, leave frontend confirmation/persistent-message changes in place; they remain compatible.

### Behavior-specific test/lint requirements

1. Add policy verification SQL checklist (manual):
   - Member can read full team list for their project.
   - Non-member cannot read unrelated project members.
   - Power user can read member lists needed for assignment UX.
2. App verification (manual + unit where possible):
   - Plan page `teamMembers` is non-empty when project has members.
   - Assignee update endpoint accepts valid member assignment.
3. Run: `npm run lint`

## Phase 5: Messaging, QA, and Release Guardrails

### Files

1. `src/app/api/v1/projects/[id]/jira/sync/route.ts` (final message envelope)
2. `src/components/plan/TaskBoard.tsx` (display copy)
3. `thoughts/shared/plans/jira-sync-ux-behavior-fix.md` (this plan artifact; reference in implementation PR)

### Concrete changes

1. Define message copy set for key outcomes:
   - Confirmation required (unassigned tasks present).
   - Sync success.
   - Partial success (some tasks failed).
   - Jira configuration mismatch.
   - Network/retry guidance.
2. Ensure all user-facing copy is understandable without Jira vocabulary.
3. Keep technical details available but secondary.
4. Add release checklist for staged verification:
   - Owner flow with assigned tasks only.
   - Owner flow with unassigned tasks + confirm gate.
   - Contributor flow with assignment options visible.
   - Power-user flow on project where they are not explicit member.

### Behavior-specific test/lint requirements

1. Full targeted suite before merge:
   - `npm run test -- src/test/unit/api/jira-sync-route.test.ts`
   - `npm run test -- src/test/unit/lib/jira/client.test.ts`
   - `npm run test -- src/test/unit/components/TaskBoard.test.tsx`
2. Full lint gate:
   - `npm run lint`
3. Optional confidence pass:
   - `npm run test`

## Risk Notes and Mitigations

1. **Risk:** Frontend/backend deploy mismatch (new UI expects structured code, old API returns plain string).  
   **Mitigation:** UI keeps fallback parsing for existing `error` strings; backend keeps `error` field alongside new `code`.

2. **Risk:** RLS select-policy overexposure if policy scope is too broad.  
   **Mitigation:** Scope policy to same-project members/owners/power users; document exact access matrix in migration SQL comments.

3. **Risk:** Jira Epic creation still fails on non-field reasons (permissions, issue type scheme).  
   **Mitigation:** Preserve clear error telemetry, show plain-language user guidance, and keep fallback retry constrained to one attempt.

4. **Risk:** Users accidentally sync unassigned tasks without noticing consequences.  
   **Mitigation:** Confirmation modal includes explicit warning text and task-count preview; default action remains cancel.

## Recommended PR Breakdown (Implementation Phase)

1. **PR A**: Backend sync contract + unit tests (`jira/sync` route).
2. **PR B**: Jira client epic fallback hardening + unit tests.
3. **PR C**: TaskBoard UX (confirmation modal + persistent dismissible feedback) + component tests.
4. **PR D**: RLS migration + manual verification evidence.

## Blocking Open Questions

None.  
Assumption used: confirmation-gated unassigned sync is the intended product behavior (default block, explicit override path).
