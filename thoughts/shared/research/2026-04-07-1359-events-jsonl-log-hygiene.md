# Research: Log hygiene for thoughts/shared/logs/events.jsonl
**Date**: 2026-04-07 13:59
**Scope**: Reviewed `thoughts/shared/logs/events.jsonl` integrity, event consistency, pairing behavior, and command/hook writers that produce the log stream.

## Key Findings
1. **JSON integrity is good**: 158/158 lines parse successfully (no malformed JSON).
2. **Session pairing is noisy**: 10 `session_start` events vs 30 `session_end` events. This creates 20 unmatched ends and can skew duration/health metrics if not deduped.
3. **Phase lifecycle currently open**: `phase_start: research` exists at line 158 without matching `phase_end` yet (expected while research is still in progress).
4. **Ordering drift exists**: line 1 has `2026-04-02T15:00:00Z`, but line 2 is earlier (`2026-04-02T10:22:23Z`), so strict chronological assumptions are unsafe.
5. **Schema drift exists for same event type**: `save_session` has two shapes; one legacy/manual row omits `uncommitted_files` and uses `action/phase` instead.
6. **Artifact path style is inconsistent**: both absolute and repo-relative paths appear in `artifact` fields, which complicates portability.
7. **Repeated near-duplicate events are common**: especially `post_edit`, plus several repeated `session_end`/`save_session`/`session_start` payloads minutes apart.

## Relevant Files
- `thoughts/shared/logs/events.jsonl` — primary log file analyzed.
- `.claude/settings.json` — hook definitions writing `session_start`, `session_end`, `post_edit`, and `guard_block` events.
- `.claude/commands/research.md` — writes `phase_start` / `phase_end` for research.
- `.claude/commands/draft-plan.md` — writes `phase_start` / `phase_end` for plan.
- `.claude/commands/implement.md` — writes `phase_start` / `phase_end` for implement.
- `.claude/commands/checkpoint.md` — writes checkpoint pass/fail events.
- `.claude/commands/save-session.md` — writes save-session events.
- `.claude/commands/metrics.md` — downstream consumer assumptions (pairing by proximity, skip malformed lines).

## Patterns Observed
- Logging is distributed across hooks and phase commands, not centralized in one writer.
- Most events are append-only and UTC timestamped (`%Y-%m-%dT%H:%M:%SZ`).
- Event payloads are mostly consistent, but older/manual entries introduce schema variants.
- High-frequency `post_edit` logging dominates volume (84/158 rows, ~53%).
- Multiple lifecycle events can fire close together (e.g., repeated stop/save hooks).

## Open Questions
- Should `session_end` be de-duplicated at write-time, or should `/metrics` handle dedupe/pairing robustly at read-time?
- Do we want a strict event schema version (e.g., `schema_version`) to support backward compatibility?
- Should `artifact` always be repo-relative for portability across machines?
- Should `post_edit` be sampled/throttled to reduce noise while preserving activity signal?
- Should research/plan/implement commands enforce guaranteed `phase_end` logging even on interruption?

## Recommendations
1. Add a small `log-hygiene` checker script that validates event schema and reports anomalies (ordering, unmatched pairs, missing required keys, path style drift).
2. Normalize `artifact` fields to repo-relative paths in all command writers.
3. Update `/metrics` pairing logic to ignore duplicate `session_end` bursts and pair by nearest unmatched `session_start` in timestamp order.
4. Introduce optional `session_id`/`phase_id` fields to make pairing deterministic instead of proximity-based.
5. Add a lightweight periodic compaction pass that emits a summary artifact and optionally archives or dedupes noisy rows (without mutating raw source unless explicitly approved).
6. Standardize `save_session` schema and backfill/handle legacy rows lacking `uncommitted_files`.

## Raw Agent Outputs
Local probe output 1 (file shape + counts):
```text
rows 158
bad 0
events Counter({'post_edit': 84, 'session_end': 30, 'save_session': 14, 'session_start': 10, 'checkpoint': 10, 'phase_start': 4, 'phase_end': 3, 'handover': 1, 'guard_block': 1, 'checkpoint_failed': 1})
phases Counter({'plan': 4, 'implement': 2, 'post-pr01': 1, 'research': 1})
```

Local probe output 2 (ordering/pairing/path drift):
```text
out_of_order_count 1
first5 [(2, '2026-04-02T10:22:23Z', 1, '2026-04-02T15:00:00Z')]
artifact_total 3 abs 2 rel 1
unmatched_start [('research', 158)]
unmatched_end []
```

Local probe output 3 (session/duplicate signals):
```text
session_starts 10
session_ends 30
paired 10 unmatched_starts 0 unmatched_ends 20
consecutive same payload (non-post_edit) examples:
69-70 session_end(uncommitted_files=24)
77-78 save_session(uncommitted_files=3)
93-95 session_end(uncommitted_files=3)
96-97 session_start(branch=codex/pr-15-jira-epic-creation,last_commit=f690fbc)
150-151 save_session(uncommitted_files=1)
```

Evidence snippets:
- Out-of-order start: lines 1-2
- Legacy save-session schema: line 60
- Duplicate starts: lines 96-97
- Open phase_start(research): line 158
