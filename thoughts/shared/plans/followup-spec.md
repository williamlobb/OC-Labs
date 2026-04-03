# Spec: Post-Implementation Follow-ups

**Date:** 2026-04-03  
**Scope:** Terminal commands + migration SQL to make the Phase 1 implementation fully operational  
**Trigger:** RALPH_COMPLETE follow-up items from Phase 1 build

---

## Problem Statement

Phase 1 code is complete and passes TypeScript + lint checks. Two database objects are missing from the live Supabase project, and `.env.local` does not exist. Without these, the app will fail at runtime:

1. `users.email_digest` column is missing → digest cron will error on query
2. `increment_vote_count` / `decrement_vote_count` RPCs are missing → voting will silently return wrong counts (the code falls back to `vote_count ± 1` but the DB counter won't actually update atomically)
3. `.env.local` is absent → `npm run dev` fails immediately

---

## Requirements

### R1 — Migration 003: Vote count RPCs

Create a new migration file `supabase/migrations/003_vote_rpcs.sql` containing two PostgreSQL functions:

```sql
-- Atomically increment vote_count and return the new value
create or replace function increment_vote_count(project_id uuid)
returns integer
language sql
security definer
as $$
  update public.projects
  set vote_count = vote_count + 1
  where id = project_id
  returning vote_count;
$$;

-- Atomically decrement vote_count (floor at 0) and return the new value
create or replace function decrement_vote_count(project_id uuid)
returns integer
language sql
security definer
as $$
  update public.projects
  set vote_count = greatest(vote_count - 1, 0)
  where id = project_id
  returning vote_count;
$$;
```

`security definer` is required so the RPC runs with elevated privileges and bypasses the RLS policy that restricts direct `UPDATE` on `projects.vote_count`.

### R2 — Apply both pending migrations to Supabase

Using the Supabase CLI, push both `002_email_digest.sql` and `003_vote_rpcs.sql` to the remote project.

Command: `supabase db push`

### R3 — Create .env.local

Copy `.env.local.example` to `.env.local`. The file already exists in the repo with all required keys listed.

Command: `cp .env.local.example .env.local`

The user must then fill in real values for the required keys before running the dev server.

---

## Acceptance Criteria

- [ ] `supabase/migrations/003_vote_rpcs.sql` exists with both functions
- [ ] `supabase db push` exits 0 (both migrations applied to remote)
- [ ] `select email_digest from users limit 1` succeeds in Supabase SQL editor
- [ ] `select increment_vote_count('<any-valid-uuid>')` succeeds in Supabase SQL editor
- [ ] `.env.local` exists (values filled in by user)
- [ ] `npm run dev` starts without crashing

---

## Implementation Approach

### Step 1 — Create migration file (code change)
Create `supabase/migrations/003_vote_rpcs.sql` with the two RPC functions above.

### Step 2 — Terminal commands to run

```bash
# 1. Copy env template (user must fill in values after)
cp .env.local.example .env.local

# 2. Push all pending migrations to Supabase remote
supabase db push
```

That's it. No other code changes needed.

### Completion criteria
The spec is done when:
- `003_vote_rpcs.sql` is created
- `.env.local` is copied from the example
- `supabase db push` runs successfully

---

## Out of Scope

- Filling in `.env.local` values (user must do this — keys are secrets)
- Supabase CLI authentication (`supabase login` / linking the project) — assumed already configured
- Phase 2 (AI capabilities) — separate spec
