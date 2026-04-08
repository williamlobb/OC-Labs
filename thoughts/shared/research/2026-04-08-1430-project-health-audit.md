# Research: Project Health Audit
**Date**: 2026-04-08 14:30
**Scope**: Memory tree, CLAUDE.md/AGENTS.md accuracy, gitignore coverage, events.jsonl hygiene, production URL discrepancy

---

## Key Findings

1. **CRITICAL — Production URL wrong in AGENTS.md**: Line 11 of `AGENTS.md` states `https://labs.theoc.ai` but the actual production URL is `https://oclabs.space`. All other files (README.md, .env.local.example, memory/core.md, agent/tools.go) correctly use `oclabs.space`. Only the RESEND_FROM email domain `noreply@labs.theoc.ai` is intentional (separate email subdomain).

2. **events.jsonl paradox**: `.gitignore` line 41 says `thoughts/shared/logs/events.jsonl` ("keep local, do not commit") but the file is **already tracked in git history**. The ignore rule is ineffective — git tracks changes to it on every session, causing stash conflicts (evidenced by commit "chore(logs): resolve stash conflict"). File is 396 lines / 28KB, all valid JSON.

3. **4 untracked artifacts not committed**: Recent research and plan files are untracked (`??`), inconsistent with older artifacts that are tracked:
   - `thoughts/shared/plans/agent-cleanup-contributor-attribution.md`
   - `thoughts/shared/plans/events-jsonl-log-hygiene-follow-up.md`
   - `thoughts/shared/research/2026-04-07-1359-events-jsonl-log-hygiene.md`
   - `thoughts/shared/research/2026-04-08-1400-agent-verbose-behavior.md`

4. **No blanket gitignore rule for thoughts/shared/**: Only `events.jsonl` is listed. There is no `thoughts/` or `thoughts/shared/logs/` pattern, so future session logs, ephemeral plans, or research notes can accumulate without clear policy.

5. **Memory tree is healthy**: 10 memory files, no duplicates, no contradictory facts. All referenced code files exist on disk. MEMORY.md index is accurate.

6. **CLAUDE.md content is accurate**: No stale TODOs or wrong patterns. One note in memory/core.md says CLAUDE.md has a stale `(board)` route group reference — but this is flagged in core.md and the content itself is consistent.

7. **Pending ADR**: Research artifact `2026-04-08-1400-agent-verbose-behavior.md` identifies a root cause (imperative tool descriptions triggering eager fetching) that should be formalised as ADR-015 in memory/core.md.

---

## Relevant Files

| File | Issue |
|------|-------|
| `AGENTS.md:11` | Wrong production URL (`labs.theoc.ai` → `oclabs.space`) |
| `thoughts/shared/logs/events.jsonl` | Tracked despite gitignore intent; causes stash conflicts |
| `.gitignore:41` | Ineffective single-file ignore rule for events.jsonl |
| `thoughts/shared/plans/agent-cleanup-contributor-attribution.md` | Untracked, should be committed or ignored |
| `thoughts/shared/plans/events-jsonl-log-hygiene-follow-up.md` | Untracked, should be committed or ignored |
| `thoughts/shared/research/2026-04-07-1359-events-jsonl-log-hygiene.md` | Untracked, should be committed or ignored |
| `thoughts/shared/research/2026-04-08-1400-agent-verbose-behavior.md` | Untracked, should be committed or ignored |
| `/Users/williamlobb/.claude/projects/.../memory/MEMORY.md` | Healthy — 10 entries, all files verified |
| `memory/core.md` | Accurate; has note about (board) vs (app) route group already |

---

## Patterns Observed

- **Artifact tracking is inconsistent**: Older `thoughts/shared/` files are tracked (pr-01, spec.md, 2026-04-02 research), newer ones are not. This suggests the gitignore policy was an afterthought.
- **events.jsonl was committed early** and the later gitignore rule couldn't untrack it. This is a common git trap — `.gitignore` doesn't untrack already-tracked files.
- **Email domain ≠ app domain**: `noreply@labs.theoc.ai` (email) vs `oclabs.space` (app) — both intentional but easy to confuse.

---

## Open Questions

1. **Policy decision**: Should `thoughts/shared/research/` and `thoughts/shared/plans/` be tracked (shared team context) or ignored (ephemeral session state)? Currently inconsistent.
2. **events.jsonl**: Remove from git history (via `git rm --cached`) and rely on ignore rule, or keep it tracked and accept the ongoing diff noise?
3. **ADR-015**: Approve the agent tool description pattern change (reactive vs imperative) documented in the 2026-04-08 research?

---

## Recommendations

### Immediate (before next commit)
1. Fix `AGENTS.md:11` — change `https://labs.theoc.ai` to `https://oclabs.space`
2. Fix `events.jsonl` tracking — run `git rm --cached thoughts/shared/logs/events.jsonl` so the gitignore rule takes effect
3. Commit the 4 untracked artifacts (or add them to gitignore if they're ephemeral)

### Short-term
4. Add a comment block to `.gitignore` clarifying policy for `thoughts/shared/`:
   ```
   # Session logs — local only, not for sharing
   thoughts/shared/logs/
   ```
5. Decide on research/plans tracking policy and document it in CLAUDE.md

### ADR
6. Add ADR-015 to `memory/core.md`: agent tool descriptions should be reactive ("returns…") not imperative ("always call this first…") to prevent eager fetching

---

## Raw Agent Outputs

See Explorer agent results above (synthesized into this artifact).
