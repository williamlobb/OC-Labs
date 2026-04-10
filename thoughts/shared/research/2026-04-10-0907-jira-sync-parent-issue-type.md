# Research: Jira Sync Parent/Issue-Type Failure (Lane 2)
**Date**: 2026-04-10 09:07
**Scope**: Traced Jira sync from UI trigger through API route and Jira payload construction; investigated issue-type selection, epic/parent linkage, and user-facing error behavior for `Issue type 10116 cannot have parent but a parent is specified.`

## Key Findings
1. **Sync currently uses a globally configured issue type, not a per-project or per-task selection.**
   - Route reads `JIRA_ISSUE_TYPE` once and applies it to every task sync call (`src/app/api/v1/projects/[id]/jira/sync/route.ts:222`, `:257`).
   - Jira client also defaults to `Task` only when input is empty (`src/lib/jira/client.ts:162`).

2. **The local environment is explicitly configured to `JIRA_ISSUE_TYPE=Epic`, which conflicts with parent linkage.**
   - `.env.local` sets `JIRA_ISSUE_TYPE=Epic` (`.env.local:26`), while example config expects `Task` (`.env.local.example:31`).
   - This is a direct match for Jira’s complaint that the selected issue type cannot have a parent.

3. **Parent linkage is automatically added whenever an Epic key exists, and Epic key is aggressively ensured.**
   - Sync route ensures an Epic key before creating issues (`src/app/api/v1/projects/[id]/jira/sync/route.ts:223`).
   - `ensureProjectEpicKey` returns existing key or creates one and persists it (`src/app/api/v1/projects/[id]/jira/sync/route.ts:126-155`).
   - `createIssue` always sets `fields.parent` when `epicKey` is present (`src/lib/jira/client.ts:175-177`).

4. **Given current logic, every unsynced task is attempted with both `issuetype` and `parent` together.**
   - For each task: `createIssue({ ..., issueType: jiraIssueType, epicKey })` (`src/app/api/v1/projects/[id]/jira/sync/route.ts:253-259`).
   - Payload fields include `issuetype: { name: ... }` and optionally `parent: { key: ... }` (`src/lib/jira/client.ts:165-168`, `:175-177`).

5. **User-facing message for this error is likely too generic relative to UX intent.**
   - Friendly-message mapper only has targeted cases for Epic-name custom field, auth, and network; otherwise it falls back to generic copy (`src/app/api/v1/projects/[id]/jira/sync/route.ts:43-90`).
   - The parent/issue-type mismatch string is not specifically handled, so users likely see “Jira sync hit an unexpected issue. Please try again.” with actionable detail hidden in technical details.
   - UX intent was to provide layperson-friendly but meaningful troubleshooting messages (`thoughts/shared/plans/jira-sync-ux-behavior-fix.md:12`, `:41`, `:96`).

## Relevant Files
- `src/app/(app)/projects/[id]/plan/page.tsx`: Plan page mounts `TaskBoard`, the UI trigger surface for sync.
- `src/components/plan/TaskBoard.tsx`: Sync button and API call (`runJiraSync`) plus presentation of error/warning details.
- `src/app/api/v1/projects/[id]/jira/sync/route.ts`: Main sync route; chooses issue type, ensures epic key, invokes `createIssue`, maps friendly errors.
- `src/lib/jira/client.ts`: Jira payload builder and POST to Jira REST API.
- `.env.local` / `.env.local.example`: Current vs expected issue-type defaults.
- `src/app/(app)/settings/integrations/page.tsx` + `src/components/settings/IntegrationsPanel.tsx`: Integrations UI shows Jira base/project config but not selected issue type.

## Patterns Observed
- **Global env-driven behavior**: One issue type (`JIRA_ISSUE_TYPE`) drives all task issue creation.
- **Unconditional parent attachment when Epic exists**: No guard based on selected issue type compatibility.
- **Partial-friendly error normalization**: Known Jira string subsets get tailored messages; unsupported strings become a generic fallback.
- **Operational opacity**: Integrations UI omits issue-type display, making misconfiguration harder to detect quickly.

## Open Questions
1. What issue type ID `10116` maps to in the target Jira project (likely `Epic` or another top-level type)?
2. Is the failing environment (local/dev/prod) actually running with `JIRA_ISSUE_TYPE=Epic` or another non-child issue type?
3. For this Jira project type/scheme, which issue types are valid children of the configured Epic hierarchy?

## Root-Cause Hypotheses (with confidence)
1. **Misconfigured selected issue type (`JIRA_ISSUE_TYPE=Epic`) combined with forced `parent` field.**
   - Confidence: **0.96 (high)**
   - Evidence: `.env.local:26`, `.env.local.example:31`, `src/app/api/v1/projects/[id]/jira/sync/route.ts:222`, `:257`, `src/lib/jira/client.ts:175-177`.

2. **Design-level mismatch: sync always sets parent when epic exists, but chosen Jira issue type/hierarchy may disallow parent.**
   - Confidence: **0.90 (high)**
   - Evidence: `src/app/api/v1/projects/[id]/jira/sync/route.ts:223`, `:253-259`, `src/lib/jira/client.ts:175-177`.

3. **Operator UX gap: issue type is not surfaced in Integrations UI, so wrong selection persists unnoticed and appears as a Jira runtime failure.**
   - Confidence: **0.78 (medium-high)**
   - Evidence: `src/app/(app)/settings/integrations/page.tsx:14-17`, props in `src/components/settings/IntegrationsPanel.tsx:147-154`, Jira metadata display `:190-199` (no issue type shown).

4. **Error-copy gap: message normalization misses this Jira parent/issue-type error, reducing actionable guidance for non-technical users.**
   - Confidence: **0.85 (high)**
   - Evidence: fallback path in `src/app/api/v1/projects/[id]/jira/sync/route.ts:87-90`; no parent/issue-type matcher in `:43-85`; UX intent in `thoughts/shared/plans/jira-sync-ux-behavior-fix.md:12`, `:41`, `:96`.

## Raw Agent Outputs
---
- File discovery located Jira sync route, Jira client payload builder, UI trigger in TaskBoard, integration settings surfaces, and related tests.
- Focused line-by-line inspection confirmed:
  - trigger path: Plan page -> TaskBoard button -> POST `/api/v1/projects/[id]/jira/sync`
  - issue type source: `process.env.JIRA_ISSUE_TYPE` in route
  - parent source: `fields.parent` in Jira client when epic key present
  - local env mismatch: `.env.local` uses `Epic`.
