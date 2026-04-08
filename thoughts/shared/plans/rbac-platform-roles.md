# Plan: RBAC -- Two-Layer Role-Based Access Control
**Date**: 2026-04-08
**Research**: `thoughts/shared/research/2026-04-08-1200-rbac-roles-permissions.md`
**Phases**: 5

## Context Summary

OC Labs currently has no platform-level roles. Permission checks are scattered across route handlers using `owner_id === user.id` or `['owner', 'contributor'].includes(membership.role)` patterns. A `brand = 'Omnia Collective'` string comparison in the `projects` RLS policy acts as an unintended admin backdoor. The task is to introduce a two-layer RBAC model (platform role on `users` + extended project role on `project_members`), centralize permission logic, add an email invite flow, and build a minimal admin UI.

---

## Phase 1: Database Migration and Types

**Goal**: Add the `platform_role` enum/column, extend `member_role` with `tech_lead`, create `role_invitations` table, update RLS policies, and seed power users.

**Files to create/modify**:
- `supabase/migrations/012_rbac.sql` -- **new** migration file
- `src/types/index.ts` -- add `PlatformRole` type, `tech_lead` to `MemberRole`, `RoleInvitation` interface, `platform_role` to `User`

**Migration must**:
1. `CREATE TYPE platform_role AS ENUM ('user', 'tech_lead', 'power_user')`
2. `ALTER TABLE public.users ADD COLUMN platform_role platform_role NOT NULL DEFAULT 'user'`
3. `ALTER TYPE member_role ADD VALUE 'tech_lead'` -- **IMPORTANT**: Cannot run inside a transaction in Postgres. If Supabase wraps migrations in a transaction, split into `012a_rbac_enum.sql` and `012b_rbac_tables.sql`
4. Seed power users: `UPDATE public.users SET platform_role = 'power_user' WHERE email IN ('will.lobb@theoc.ai', 'will@theoc.ai')` (no-op if users don't exist yet -- covered by invite flow in Phase 4)
5. Also seed `role_invitations` rows for both emails with pre-generated tokens (so the auth callback picks them up on first login if the UPDATE was a no-op)
6. Create `role_invitations` table:
   ```sql
   CREATE TABLE public.role_invitations (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     email text NOT NULL,
     platform_role platform_role,
     project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
     project_role member_role,
     invited_by uuid REFERENCES public.users(id),  -- nullable for seed rows
     token text UNIQUE NOT NULL,
     accepted_at timestamp with time zone,
     created_at timestamp with time zone DEFAULT now()
   );
   ALTER TABLE public.role_invitations ENABLE ROW LEVEL SECURITY;
   ```
7. RLS on `role_invitations`:
   - SELECT: power_user platform role OR `email = auth.jwt()->>'email'`
   - INSERT: power_user only (project invitations handled via admin client in route handler)
8. **Drop** the `write projects` policy: `DROP POLICY "write projects" ON public.projects`
9. **Replace** with three policies:
   - `insert projects`: `FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user'))`
   - `update projects`: `FOR UPDATE USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user'))`
   - `delete projects`: `FOR DELETE USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user'))`
10. Update `write updates` policy to include `tech_lead` role: `role IN ('owner', 'contributor', 'tech_lead')`
11. Update `join` policy on `project_members` to allow power_user + project owner management:
    ```sql
    -- Drop old, replace with:
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user')
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_members.project_id AND owner_id = auth.uid())
    ```
12. Update content table policies (context_blocks, tasks) to include `tech_lead`:
    ```sql
    role IN ('owner', 'contributor', 'tech_lead')
    ```
    And add power_user bypass:
    ```sql
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user')
    ```

**Type additions in `src/types/index.ts`**:
- `export type PlatformRole = 'user' | 'tech_lead' | 'power_user'`
- Add `'tech_lead'` to `MemberRole` union
- Add `platform_role?: PlatformRole` to `User` interface
- Add `RoleInvitation` interface

**Tests**:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] Manual: apply migration, verify `platform_role` column exists, old `write projects` policy is gone, `role_invitations` table exists

**Dependencies**: None

---

## Phase 2: Centralized Permission Helpers

**Goal**: Create a single permission module that all route handlers call instead of inline ownership/membership checks.

**New file**: `src/lib/auth/permissions.ts`

**Functions**:
```typescript
// Fetches the user's platform_role from the users table
// Defaults to 'user' if column is missing (safe rollout)
async function getPlatformRole(supabase, userId): Promise<PlatformRole>

// Shorthand checks
function isPowerUser(role: PlatformRole): boolean

// Can user edit project content (context, tasks, plan, updates)?
// True if: power_user OR project member with role in [owner, tech_lead, contributor]
async function canEditProjectContent(supabase, userId, projectId): Promise<boolean>

// Can user edit project settings (title, description, status, notion_url, jira_epic_key)?
// True if: power_user OR owner_id matches
async function canEditProjectSettings(supabase, userId, projectId): Promise<boolean>

// Can user manage members (approve, add, remove)?
// True if: power_user OR owner_id matches
async function canManageMembers(supabase, userId, projectId): Promise<boolean>

// Can user create a project?
// True if: power_user
async function canCreateProject(supabase, userId): Promise<boolean>

// Can user delete a project?
// True if: power_user OR owner_id matches
async function canDeleteProject(supabase, userId, projectId): Promise<boolean>
```

**Design**: Each function does at most one DB query. `getPlatformRole` is the workhorse. To avoid repeated DB calls, callers can pass a pre-fetched `platformRole` via optional parameter.

**Tests**:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes

**Dependencies**: Phase 1 (types must exist)

---

## Phase 3: Update All Existing Route Handlers

**Goal**: Replace inline permission checks in every route handler with centralized helpers.

**Route handlers to update** (14 files):

| File | Change |
|------|--------|
| `src/app/api/v1/projects/route.ts` (POST) | Gate on `canCreateProject()`, 403 if not power_user |
| `src/app/api/v1/projects/[id]/route.ts` (PUT) | Use `canEditProjectSettings()` instead of `owner_id === user.id` |
| `src/app/api/v1/projects/[id]/route.ts` (DELETE) | Use `canDeleteProject()` instead of `owner_id === user.id` |
| `src/app/api/v1/projects/[id]/hand-raises/[userId]/approve/route.ts` | Use `canManageMembers()` |
| `src/app/api/v1/projects/[id]/context/route.ts` (POST) | Use `canEditProjectContent()` |
| `src/app/api/v1/projects/[id]/context/[blockId]/route.ts` (PUT/DELETE) | Use `canEditProjectContent()` |
| `src/app/api/v1/projects/[id]/tasks/route.ts` (POST) | Use `canEditProjectContent()` |
| `src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts` (PATCH/DELETE) | Use `canEditProjectContent()` |
| `src/app/api/v1/projects/[id]/plan/route.ts` (POST) | Use `canEditProjectContent()` |
| `src/app/api/v1/projects/[id]/updates/route.ts` (POST) | Use `canEditProjectContent()` |
| `src/app/api/v1/projects/[id]/jira/sync/route.ts` (POST) | Use `canEditProjectContent()` |
| `src/app/api/v1/projects/[id]/needs-help/route.ts` (POST) | Use `canEditProjectSettings()` |
| `src/app/api/v1/projects/[id]/chat/route.ts` (POST) | Use `canEditProjectContent()` |
| `src/app/api/v1/discover/chat/route.ts` (POST) | Gate `createProject` tool on `canCreateProject()` |

**UI pages to update**:

| File | Change |
|------|--------|
| `src/app/(app)/projects/[id]/edit/page.tsx` | Replace `owner_id !== user.id` with `canEditProjectSettings()` |
| `src/app/(app)/projects/new/page.tsx` | Add `canCreateProject()` guard; redirect non-power_users |
| `src/app/(app)/discover/page.tsx` | Hide "New project" link + `DiscoverChatPanel` for non-power_users |

**Tests**:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] Manual: non-power_user cannot POST to `/api/v1/projects`
- [ ] Manual: power_user can approve hand-raises on any project
- [ ] Manual: contributor can still POST context blocks / tasks on their project
- [ ] Manual: project owner can still PUT project settings

**Dependencies**: Phase 2

---

## Phase 4: Invite Flow, Auth Callback, and New API Routes

**Goal**: Implement email-based role invitations, member management routes, and hook auth callback to apply pending invitations.

**New files**:
- `src/lib/email/invite.ts` -- Resend email templates for role invitations
- `src/app/api/v1/admin/invitations/route.ts` -- `POST`: power_user sends invite
- `src/app/api/v1/invitations/[token]/accept/route.ts` -- `GET`: accept invite, apply role, redirect
- `src/app/api/v1/admin/users/[id]/role/route.ts` -- `PATCH`: power_user updates platform role directly
- `src/app/api/v1/projects/[id]/members/route.ts` -- `POST`: owner/power_user adds member directly
- `src/app/api/v1/projects/[id]/members/[userId]/route.ts` -- `DELETE`: owner/power_user removes member

**Files to modify**:
- `src/app/auth/callback/route.ts` -- after auth, query `role_invitations` for user's email where `accepted_at IS NULL`. Apply pending platform_role and project assignments, mark as accepted.

**Email template** (`src/lib/email/invite.ts`):
- `sendRoleInviteEmail(email, role, inviterName, acceptUrl)` -- follows Resend pattern from `digest.ts`
- Subject: "You've been invited to OC Labs"
- Body: role name, inviter name, CTA button to accept URL

**Invite accept route** (`/api/v1/invitations/[token]/accept`):
1. Look up invitation by token
2. If expired or already accepted, redirect with error
3. Require authenticated session (redirect to login with `next` param if not)
4. Verify authenticated user's email matches invitation email
5. Apply: update `users.platform_role` if set; upsert `project_members` if project role set
6. Mark `accepted_at = now()`
7. Redirect to project page or `/discover`

**Tests**:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] Manual: power_user can POST invite, email is sent, row appears in DB
- [ ] Manual: accepting token applies role correctly
- [ ] Manual: new user logging in with pending invite gets role via auth callback
- [ ] Manual: owner can add/remove members on their project
- [ ] Manual: power_user can add/remove members on any project

**Dependencies**: Phase 3

---

## Phase 5: Admin UI Page

**Goal**: Build a power_user-only `/admin` page for managing platform roles and project assignments.

**New files**:
- `src/app/(app)/admin/page.tsx` -- server component, gates on `platform_role = 'power_user'`, renders two panels
- `src/components/admin/PlatformRolesPanel.tsx` -- client component: list users with roles, change via PATCH
- `src/components/admin/ProjectAssignmentsPanel.tsx` -- client component: list projects with owners/leads, send invites
- `src/components/admin/InviteDialog.tsx` -- client component: email + role selection form dialog

**Files to modify**:
- Navigation layout component -- add "Admin" link visible only to power_users

**Page structure**:
1. Server component: fetch user's `platform_role`; return `notFound()` if not power_user
2. Fetch all users and projects via `supabaseAdmin`
3. Render `PlatformRolesPanel` and `ProjectAssignmentsPanel` with data

**Tests**:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] Manual: non-power_user at `/admin` sees 404
- [ ] Manual: power_user can view users, change roles, send invites

**Dependencies**: Phase 4

---

## Rejected Alternatives

| Option | Why Rejected |
|--------|-------------|
| Middleware-level RBAC check | Middleware can't make DB queries efficiently (runs on every request) |
| Supabase RPC for all permissions | Spreads business logic across SQL + TS; harder to test |
| JWT custom claims for platform_role | Requires Auth hooks, adds JWT refresh complexity, role can go stale |
| Separate `project_settings` table | Over-engineering; settings/content split is enforced at route handler level |
| Remove `observer` from enum | Removing Postgres enum values is destructive; keep unused |

---

## Open Questions (RESOLVED)

1. **Seeding `will@theoc.ai` before account**: ✅ **YES** — Seed BOTH an UPDATE + a `role_invitations` row with a pre-generated token. Auth callback applies it on first login.

2. **Discover page AI assistant**: ✅ **PARTIAL** — Hide `DiscoverChatPanel` for non-power_users in v1. **Future enhancement**: Allow users to submit project **ideas** for review (need overlap detection vs existing projects). Power user creation via idea submission page is a future build.

3. **Orphaned projects**: ✅ **NO QUERY NEEDED** — Will.lobb will assign himself as product owner in migration, then transfer ownership to another product owner later if needed.
