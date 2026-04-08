# Draft Plan: Events Log Hygiene Follow-Up (`thoughts/shared/logs/events.jsonl`)

**Research base**: `thoughts/shared/research/2026-04-07-1359-events-jsonl-log-hygiene.md`  
**Goal**: Improve reliability and interpretability of pipeline metrics by tightening event schema consistency, reducing duplicate lifecycle noise, and making log consumers resilient without destructive rewrites.

## Scope

- Standardize event payload shape for core lifecycle events (`session_start`, `session_end`, `phase_start`, `phase_end`, `save_session`, `checkpoint`, `checkpoint_failed`, `guard_block`, `post_edit`).
- Normalize artifact paths to repo-relative format.
- Harden `/metrics` parsing/pairing logic for duplicate and out-of-order patterns already present in logs.
- Add a non-destructive log hygiene checker/report path.

## Out of Scope

- Rewriting historical log entries in-place.
- Changing app user-facing product behavior.
- Introducing external dependencies beyond bash/python3/git already used by pipeline commands.

## Phase 1: Schema Contract + Writer Consistency

### Changes

1. Create a lightweight schema contract doc for pipeline events.
2. Update command writers and hooks to emit consistent keys per event type.
3. Normalize `artifact` values to repo-relative paths in phase-end events.

### Files

- `.claude/settings.json`
- `.claude/commands/draft-plan.md`
- `.claude/commands/research.md`
- `.claude/commands/implement.md`
- `.claude/commands/checkpoint.md`
- `.claude/commands/save-session.md`
- `thoughts/shared/logs/schema.md` (new)

### Behavioral Requirements

- `save_session` always includes `uncommitted_files`.
- `phase_end` always includes `phase` and, when applicable, normalized repo-relative `artifact`.
- Event timestamps remain UTC ISO Z format.

### Verification

- Trigger each command once in a throwaway flow and confirm emitted events match `schema.md`.
- Run a parser sanity check over the full existing `events.jsonl` and confirm no crashes when mixed legacy rows exist.

## Phase 2: `/metrics` Robustness Hardening

### Changes

1. Update `/metrics` logic documentation to define robust pairing rules:
   - Pair by nearest unmatched start/end in timestamp order.
   - Ignore immediate duplicate terminal events with identical payloads within a short window.
2. Add explicit handling for legacy schema variants (e.g., old `save_session` rows without `uncommitted_files`).
3. Document out-of-order tolerance (input-order and timestamp-order behavior).

### Files

- `.claude/commands/metrics.md`

### Behavioral Requirements

- Session KPIs are stable in presence of repeated `session_end` rows.
- Phase metrics avoid double-counting duplicated starts/ends.
- Missing optional fields do not break metrics output.

### Verification

- Run `/metrics` against current log and confirm dashboard renders without manual cleanup.
- Validate counts against a known fixture sample including duplicates/out-of-order events.

## Phase 3: Add Log Hygiene Checker (Read-Only)

### Changes

1. Add a checker utility that scans `events.jsonl` and reports:
   - JSON parse errors
   - schema mismatches by event type
   - unmatched session/phase start/end counts
   - duplicate bursts
   - absolute-path artifact usage
2. Expose checker via a command (or documented invocation) for periodic maintenance.

### Files

- `thoughts/shared/logs/check-hygiene.py` (new)
- `.claude/commands/metrics.md` (link checker as optional companion)
- `README.md` (small section on running hygiene checks)

### Behavioral Requirements

- Checker is strictly read-only by default.
- Output is actionable and includes line references.

### Verification

- Run checker on current log and verify expected anomalies are reported.
- Confirm checker exits non-zero only when explicitly requested strict mode is enabled.

## Phase 4: Optional Metadata for Deterministic Pairing

### Changes

1. Add optional IDs to future events:
   - `session_id` for session start/end
   - `phase_id` for phase start/end
2. Keep backward compatibility with legacy rows that lack IDs.

### Files

- `.claude/settings.json`
- `.claude/commands/draft-plan.md`
- `.claude/commands/research.md`
- `.claude/commands/implement.md`
- `.claude/commands/save-session.md`
- `.claude/commands/metrics.md`
- `thoughts/shared/logs/schema.md`

### Behavioral Requirements

- New logs include IDs; old logs remain parseable.
- `/metrics` prefers ID-based pairing when present, otherwise falls back to heuristic pairing.

### Verification

- Simulate mixed streams (with and without IDs) and confirm equivalent KPI output.

## Risks and Mitigations

- **Risk**: Overfitting metrics logic to one noisy log sample.
  - **Mitigation**: Use documented pairing rules + fixture-based validation cases.
- **Risk**: Breaking current command hooks while changing writer snippets.
  - **Mitigation**: Keep each writer snippet small; test each command flow after edits.
- **Risk**: Inconsistent path normalization across commands.
  - **Mitigation**: Use one shared normalization pattern (`repo-relative`) and verify with checker.

## Test Plan Summary

- Command smoke checks: `/research`, `/draft-plan`, `/implement` (dry command workflow), `/save-session`, `/metrics`.
- Log fixture checks for duplicates, out-of-order timestamps, and missing keys.
- Regression check: ensure existing `events.jsonl` remains consumable without edits.

## Open Questions (Need Human Decision Before `/implement`)

1. Should duplicate suppression happen primarily at **write time**, **read time (`/metrics`)**, or both?
2. Do we want to add `session_id` / `phase_id` now (larger change) or defer to a second pass?
3. Should artifact paths be standardized to **repo-relative only** from now on?
4. For hygiene checker strict mode, should CI eventually fail on schema drift or stay advisory-only?

## Suggested Implementation Order

1. Phase 1 (schema + writer normalization)
2. Phase 2 (`/metrics` robustness)
3. Phase 3 (checker)
4. Phase 4 (optional IDs)

This order delivers immediate value with minimal risk and keeps the deterministic-ID enhancement optional.
