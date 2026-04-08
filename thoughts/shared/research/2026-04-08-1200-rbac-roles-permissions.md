# Research: RBAC Roles & Permissions
**Date**: 2026-04-08 12:00 (updated 2026-04-08 with design clarifications)
**Scope**: Existing auth/permission model, DB schema, RLS policies, route-level checks, role design for new RBAC system

## Confirmed Design Decisions (from product owner)

- `tech_manager` renamed to **`tech_lead`** everywhere
- Power users to seed: **`will.lobb@theoc.ai`** and **`will@theoc.ai`** (both power_user)
- **Pre-seeding answer:** Use a `pending_role_invitations` table. Power users send an email invite with an assigned role; the row is keyed on email. When the invited user first logs in, the auth callback applies the pending role. This means `will@theoc.ai` can be seeded before he creates an account — his role will be applied automatically on first login.
- **Only power users can create projects.** Tech leads and product owners cannot create projects.
- **Project assignment flow:** Power user creates project → power user assigns a Product Owner (and optionally a Tech Lead) → product owner can then directly assign/approve further members (contributors).
- **Product owners can remove members** from their project. Power users can also remove any member.
- **Email invite flow required** for all role assignments (both platform roles and project assignments).

---

## Key Findings

1. **No platform-level roles exist today.** The `users` table has no role column. The only privilege escalation is a hardcoded `brand = 'Omnia Collective'` check in the `projects` RLS policy — a string comparison, not an enum, and not enforced at auth level.

2. **Project-scoped roles exist via `project_members.role`** — enum: `owner | contributor | interested | observer`. `observer` is defined but never used in any route or RLS policy.

3. **Current permission model maps cleanly to two of the five requested roles:**
   - `contributor` in `project_members` ≈ requested "Team Member"
   - `owner` in `project_members` ≈ requested "Product Owner"

4. **Two roles have no representation:** `tech_manager` (platform-level, edits any project content except settings) and `power_user` (global admin, can create/edit any project). These need a new `platform_role` column on `users`.

5. **RLS policies are permissive in the right places** — all reads are open to any authenticated user; writes are gated on `project_members.role`. The `brand = 'Omnia Collective'` write-gate on `projects` must be replaced with a proper `platform_role` check.

6. **Route handlers enforce most checks** — owner checks use `owner_id === user.id` comparisons; contributor checks use a `project_members` lookup. Migrating to platform roles requires updating both the RLS policies (migration) and route-level guards (middleware helper).

7. **No admin UI exists.** Role assignment will need either a Supabase dashboard operation or a new `/admin` route gated to `power_user`. Seeding `william.lobb@theoc.ai` as `power_user` can be done in the migration itself.

8. **Voting already blocks project owners** — route handler prevents `owner_id === user.id` from voting, but this is app-level only; RLS doesn't enforce it.

9. **`project_members` RLS only allows `user_id = auth.uid()`** — meaning only the user themselves can change their own membership. Power users and tech managers editing any project's team would need either a new RLS policy or an admin-only RPC.

10. **`hand-raises/[userId]/approve` is owner-only** — currently checks `owner_id === user.id`. Under new RBAC, Product Owners AND Power Users should be able to approve.

---

## Proposed Role Matrix

| Action | User | Contributor | Tech Lead | Product Owner | Power User |
|--------|------|-------------|-----------|---------------|------------|
| Vote on project | ✅ | ✅ | ✅ | ❌ (own project) | ✅ |
| Raise hand | ✅ | ✅ | ✅ | N/A | ✅ |
| Post to context tab | ❌ | ✅ (assigned project) | ✅ (assigned project) | ✅ (own project) | ✅ (any) |
| Update plan card status | ❌ | ✅ (assigned project) | ✅ (assigned project) | ✅ (own project) | ✅ (any) |
| Post project update | ❌ | ✅ (assigned project) | ✅ (assigned project) | ✅ (own project) | ✅ (any) |
| Edit project settings | ❌ | ❌ | ❌ | ✅ (own project) | ✅ (any) |
| Approve/reject hand-raises | ❌ | ❌ | ❌ | ✅ (own project) | ✅ (any) |
| Directly assign members | ❌ | ❌ | ❌ | ✅ (own project) | ✅ (any) |
| Remove members | ❌ | ❌ | ❌ | ✅ (own project) | ✅ (any) |
| Create new project | ❌ | ❌ | ❌ | ❌ | ✅ |
| Assign project to owner/lead | ❌ | ❌ | ❌ | ❌ | ✅ |
| Edit any project content | ❌ | ❌ | ✅ (assigned project only) | ✅ (own project) | ✅ (any) |
| Delete project | ❌ | ❌ | ❌ | ✅ (own only) | ✅ (any) |
| Assign/change platform roles | ❌ | ❌ | ❌ | ❌ | ✅ |

**Note on Tech Lead scope:** Tech leads are assigned to specific projects by power users. Their elevated content-editing rights apply only to the project(s) they've been assigned to — not globally to all projects. They remain in `project_members` with a distinct role.

---

## Design Decision: Two-Layer Model

**Layer 1 — Platform role** (new column on `users`):
```sql
CREATE TYPE platform_role AS ENUM ('user', 'tech_lead', 'power_user');
ALTER TABLE public.users ADD COLUMN platform_role platform_role NOT NULL DEFAULT 'user';
```
- `user` = everyone by default
- `tech_lead` = assigned to projects by power users; elevated content rights on assigned projects
- `power_user` = full admin; only role that can create projects

**Layer 2 — Project role** (existing `project_members.role`, extended to add `tech_lead`):
```sql
-- Extend enum
ALTER TYPE member_role ADD VALUE 'tech_lead';
```
- `interested` = raised hand, pending approval
- `contributor` = approved team member
- `tech_lead` = assigned by power user; can edit all project content except settings
- `owner` = product owner — assigned by power user; full control of this project

**Assignment flow:**
1. Power user creates project → they become initial owner OR explicitly assign an owner
2. Power user can assign a tech_lead to the project (adds them to `project_members` with role `tech_lead`)
3. Product owner can then: approve hand-raises, directly invite members, remove members
4. All assignments trigger email notifications

**Project settings** = `name`, `description`, `status`, `notion_url`, `jira_epic_key`. Only project `owner` role or platform `power_user` can update these.

---

## Role Assignment: Email Invite Flow

### Pending Invitations Table (new)
```sql
CREATE TABLE public.role_invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  platform_role platform_role,       -- null if this is a project assignment only
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  project_role member_role,           -- null if this is a platform-only invite
  invited_by uuid REFERENCES public.users(id) NOT NULL,
  token text UNIQUE NOT NULL,         -- secure random token for accept link
  accepted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
```

### Flow for existing users
1. Power user goes to `/admin/roles` or product owner goes to project settings → "Invite / Assign"
2. They enter an email address and select a role
3. System calls `POST /api/v1/admin/invitations` (power_user only) or `POST /api/v1/projects/[id]/invitations` (owner/power_user)
4. Resend sends an email: "You've been assigned [role] on OC Labs — click to accept"
5. User clicks link → `GET /api/v1/invitations/[token]/accept` → role applied, redirect to project or board

### Flow for users who haven't signed up yet (e.g. `will@theoc.ai`)
- Same flow. Invitation row is stored with their email.
- When they first log in via Supabase Auth, the auth callback (`/auth/callback`) checks `role_invitations` for their email.
- Any pending accepted invitations are applied. Unaccepted invitations remain pending — user can accept via email link.
- **Seeding:** `will@theoc.ai` and `will.lobb@theoc.ai` will be seeded directly in the migration as `power_user` (no invite needed for these two since we're doing it at bootstrap).

### Admin UI (`/admin`)
- Gated to `platform_role = 'power_user'`
- Two sections: **Platform Roles** (manage user → platform_role) and **Project Assignments** (assign owners/tech leads to projects)
- Uses `PATCH /api/v1/admin/users/[id]/role` with service role client

---

## What Needs to Change

### Database (new migration `012_rbac.sql`)
1. Create `platform_role` enum: `user | tech_lead | power_user`
2. Add `platform_role` column to `users` (default `user`)
3. Extend `member_role` enum: add `tech_lead` value
4. Seed `will.lobb@theoc.ai` and `will@theoc.ai` as `power_user`
5. Create `role_invitations` table with RLS
6. Drop `brand = 'Omnia Collective'` from projects RLS
7. Rewrite projects RLS: create/edit gated to `power_user` OR `owner_id`; content write gated to `owner | tech_lead | contributor` in membership OR `power_user` platform role
8. Add RLS: project settings write = `owner_id = auth.uid()` OR platform `power_user`
9. Add route for removing members: `DELETE /api/v1/projects/[id]/members/[userId]`

### New API Routes
- `POST /api/v1/admin/invitations` — power_user sends platform role invite
- `POST /api/v1/projects/[id]/invitations` — owner or power_user sends project invite  
- `GET /api/v1/invitations/[token]/accept` — accept invite, apply role
- `PATCH /api/v1/admin/users/[id]/role` — power_user updates platform role (service role)
- `DELETE /api/v1/projects/[id]/members/[userId]` — owner or power_user removes member
- `POST /api/v1/projects/[id]/members` — owner/power_user directly adds member (no hand-raise)

### Updated Route Handlers
- `src/lib/auth/permissions.ts` — new helper: `canEditProjectContent()`, `canEditProjectSettings()`, `canManageProjectMembers()`
- `projects/[id]/route.ts` (PUT) — split settings vs content fields; settings gated to owner/power_user only
- `projects/[id]/route.ts` (DELETE) — owner or power_user only
- `projects/route.ts` (POST) — restrict to platform `power_user` only
- `hand-raises/[userId]/approve/route.ts` — add power_user bypass
- All content routes (context, tasks, updates, plan) — use `canEditProjectContent()` helper

### New Pages
- `src/app/(board)/admin/page.tsx` — power_user admin panel: manage platform roles, assign owners/leads to projects
- `src/app/(board)/projects/[id]/settings/page.tsx` — project settings page for owners (rename, status, delete)
- `src/app/(board)/invitations/[token]/page.tsx` — invite accept landing page

### Email Templates (Resend)
- Platform role invite email
- Project assignment email (you've been added as owner/tech_lead/contributor to [project])
- Member removed notification

### Types
- Add `platform_role: 'user' | 'tech_lead' | 'power_user'` to `User` in `src/types/index.ts`
- Add `tech_lead` to `MemberRole` union
- Add `RoleInvitation` type

---

## Relevant Files

| File | Notes |
|------|-------|
| `supabase/migrations/001_initial.sql` | Core schema, RLS policies — will need update for platform_role |
| `src/types/index.ts` | `User`, `Project`, `ProjectMember`, `MemberRole` types |
| `src/lib/supabase/server.ts` | Server client — used in all route handlers |
| `src/lib/supabase/admin.ts` | Service role client — for role assignment endpoint |
| `src/app/api/v1/projects/[id]/route.ts` | PUT/DELETE — owner check at line 28, 87 |
| `src/app/api/v1/projects/[id]/hand-raises/[userId]/approve/route.ts` | Owner-only approve |
| `src/app/api/v1/projects/route.ts` | POST — currently any authenticated user can create |
| `src/app/api/v1/projects/[id]/context/[blockId]/route.ts` | Contributor check line 77 |
| `src/app/api/v1/projects/[id]/tasks/[taskId]/route.ts` | Contributor check line 34 |
| `src/app/api/v1/projects/[id]/plan/route.ts` | Contributor check |

---

## Open Questions (resolved)

1. ~~Should tech_lead create projects?~~ **No** — only power_user can create.
2. ~~Can power_user own a project?~~ **Yes** — when power user creates a project they become owner, or they assign one.
3. ~~Who removes members?~~ **Product owner (own project) and power_user (any project).**
4. ~~Invite flow?~~ **Yes — email invite via Resend with accept link; pending invites stored in DB.**
5. **`observer` role:** Keep in enum for now, treat as read-only / unused. Don't add logic for it.
6. **Does tech_lead bypass hand-raise?** Yes — power user directly assigns them, no hand-raise needed.
7. **Can product owner invite a non-registered user?** Yes — invite by email, pending until they sign up.

---

## Raw Agent Outputs

---

### Agent 1: Auth, Users, DB Schema

[Full output covers: users table schema, email_digest, project_members enum, brand-as-role pattern, RLS policies for all tables, middleware pattern, supabase client files, API routes for /users/me, api-keys, unsubscribe, raise-hand, approve, create project, full migration file inventory]

Key quote: "No user-level roles in DB (roles are project-scoped). `brand` field is a string, not enforced at DB level."

---

### Agent 2: Project Permissions, Voting, Team Membership

[Full output covers: owner_id checks in PUT/DELETE routes, membership role checks in plan/context/tasks/updates/chat, voting restriction (app-level), hand-raise toggle, RLS gaps (voting not in RLS, brand backdoor), missing audit trail, no field-level permissions, MemberRole type definition in types/index.ts]

Key quote: "The hardcoded `brand = 'Omnia Collective'` check in projects table RLS is a backdoor that makes ANY Omnia Collective user able to modify any project regardless of ownership."
