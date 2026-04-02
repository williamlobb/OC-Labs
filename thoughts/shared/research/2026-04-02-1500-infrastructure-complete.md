# Research: Infrastructure Complete — Ready for Phase 1 Implementation

**Date**: 2026-04-02 15:00
**Scope**: Full infrastructure audit before Phase 1 MVP implementation begins
**Created by**: Cowork session (Anthropic Claude) — handover to Claude Code

---

## Key Findings

1. **All infrastructure is live.** Supabase DB, Vercel deployment (oclabs.space), GitHub OAuth, Resend, Slack webhooks — all configured and verified working.

2. **Foundation code already exists in the repo.** Unlike a greenfield project, the lib layer is already written and should NOT be regenerated:
   - src/lib/supabase/client.ts — browser singleton
   - src/lib/supabase/server.ts — SSR client with cookie handling
   - src/lib/supabase/admin.ts — service role client
   - src/lib/supabase/middleware.ts — session refresh + auth redirect
   - src/lib/notifications/slack.ts — all 4 webhook functions (notifyProjectUpdate, notifyNeedsHelp, notifyMilestone, dmOwnerRaisedHand)
   - src/lib/github/repo.ts — fetchRepoMetadata with README preview
   - src/lib/cowork/client.ts — fetchCoWorkProfile
   - src/lib/utils/avatar.ts — deterministic avatarColor from userId
   - src/types/index.ts — ALL interfaces defined (Project, User, Vote, ProjectMember, ProjectUpdate, UserSkill, ProjectCardProps, ProfileCardProps, AvatarColor)

3. **10 draft PRs are open on GitHub targeting `develop`.** Each has a stub commit. Implementation branches are feat/pr-01-auth-shell through feat/pr-10.

4. **The app shell is default Next.js.** src/app/layout.tsx and src/app/page.tsx are Next.js boilerplate. The entire app UI needs to be built.

5. **No route groups exist yet.** Need to create (auth)/ and (board)/ route groups with their respective layout.tsx files.

6. **middleware.ts does not exist at root yet.** The logic is written in src/lib/supabase/middleware.ts but there is no root middleware.ts that calls it.

7. **No components directory exists yet.** src/components/ is empty/absent.

8. **DB is fully seeded.** 7 projects and 8 users exist in Supabase. Any implementation can query real data immediately.

9. **Next.js 15 breaking changes are material.** AGENTS.md enforces reading node_modules/next/dist/docs/ first. Key breaks: cookies() is async, no more getServerSideProps, Route Handlers replace API routes pattern.

10. **CoWork integration is stub-complete but not live.** fetchCoWorkProfile gracefully returns null when COWORK_API_KEY/URL not set. Implement UI to handle both states (synced vs not yet synced).

---

## What Needs to Be Built (Phase 1 Scope)

### PR-01: Auth Shell
Files to create:
- middleware.ts (root) — import updateSession from lib/supabase/middleware.ts, add matcher config
- src/app/(auth)/layout.tsx — minimal layout, no nav
- src/app/(auth)/login/page.tsx — email/password login form + GitHub OAuth button
- src/app/(auth)/signup/page.tsx — email/password signup form
- src/app/auth/callback/github/route.ts — OAuth exchange handler (use supabaseAdmin to handle code exchange)
Key behaviours:
- Login redirects to /board after session established
- Unauthenticated access to (board) routes redirects to /login?redirectTo=[path]
- GitHub OAuth uses PKCE flow via Supabase Auth

### PR-02: ProjectCard Component
Files to create:
- src/components/board/ProjectCard.tsx — accepts ProjectCardProps from types/index.ts
- src/components/ui/Avatar.tsx — initials avatar using avatarColor() from lib/utils/avatar.ts
- src/components/ui/Badge.tsx — status badge (Idea, In progress, etc.)
Key behaviours:
- Card shows: title, brand, status badge, summary excerpt, skills needed chips, owner avatar, vote count
- Vote button is togglable (onVote callback)
- Raise hand button (onJoin callback)
- Needs-help indicator if needsHelp=true
- onClick navigates to project detail

### PR-03: Discovery Board
Files to create:
- src/app/(board)/layout.tsx — nav shell with user avatar + signout
- src/app/(board)/board/page.tsx — server component, fetches all projects from Supabase
- src/components/board/BoardToolbar.tsx — search input + filter chips
- src/components/board/FilterChips.tsx — status filter chips
Key behaviours:
- Server Component fetches projects ordered by vote_count desc
- Passes to client FilterableBoard component for client-side filtering
- Filter by status, search by title/summary/brand
- Empty state when no projects match

### PR-04: Raise Hand Mechanic
Files to create:
- src/app/api/v1/projects/[id]/raise-hand/route.ts — POST handler
Key behaviours:
- POST inserts into project_members (role: 'interested') or removes if already exists (toggle)
- Uses session user from Supabase auth
- On success: calls dmOwnerRaisedHand() from lib/notifications/slack.ts
- Returns 200 with updated member count

### PR-05: Vote Mechanic
Files to create:
- src/app/api/v1/projects/[id]/vote/route.ts — POST handler
Key behaviours:
- POST inserts into votes or removes if already voted (toggle)
- Updates projects.vote_count via Supabase RPC or manual count query
- Returns 200 with new vote_count and hasVoted boolean

### PR-06: ProfileCard Component
Files to create:
- src/components/profile/ProfileCard.tsx — accepts ProfileCardProps from types/index.ts
- src/components/profile/SkillChips.tsx — skill tags
Key behaviours:
- Shows: avatar (photo or initials), name, title, brand, skills, projects contributed to, vote count, activity score
- LinkedIn and GitHub links if present
- CoWork sync status indicator

### PR-07: My Profile View
Files to create:
- src/app/(board)/profile/page.tsx — server component, fetches current user's data
- src/app/(board)/profile/[id]/page.tsx — public profile view
Key behaviours:
- My profile shows editable fields: linkedin_url, github_username, skills (from user_skills table)
- Profile photo and name/title/brand shown as read-only (CoWork sourced)
- Edit form POSTs to api/v1/users/me

### PR-08: GitHub Repo Link + README Preview
Files to create:
- src/components/board/RepoPreview.tsx — uses fetchRepoMetadata from lib/github/repo.ts
Key behaviours:
- ProjectCard and ProjectDetail show linked repos
- RepoPreview shows: repo name, description, star count, language, last updated, README excerpt (500 chars)
- Gracefully handles null (repo not found or rate limited)
- Data cached via Next.js fetch cache (revalidate: 3600)

### PR-09: Project Registration Form
Files to create:
- src/app/(board)/projects/new/page.tsx — client component with form
- src/app/api/v1/projects/route.ts — POST handler
Key behaviours:
- Form fields: title, summary, status, brand, github_repos (multi-input), skills_needed (tag input)
- On submit: inserts into projects, inserts owner into project_members (role: 'owner')
- Calls notifyProjectUpdate() on success
- Redirects to /board/projects/[id] after creation

### PR-10: Needs-Help Flag + Slack Notification
Files to create:
- src/app/api/v1/projects/[id]/needs-help/route.ts — POST handler
Key behaviours:
- POST toggles projects.needs_help boolean
- When set to true: calls notifyNeedsHelp() from lib/notifications/slack.ts
- Only project owner can toggle (check project_members.role = 'owner')
- Returns 200 with updated needs_help state

---

## Relevant Files

src/types/index.ts — read this first before writing any component
src/lib/supabase/server.ts — use createServerSupabaseClient() in all Server Components
src/lib/supabase/admin.ts — use supabaseAdmin only in Route Handlers
src/lib/supabase/middleware.ts — updateSession() to wire into root middleware.ts
src/lib/notifications/slack.ts — all Slack notification helpers already written
src/lib/github/repo.ts — RepoMetadata type + fetchRepoMetadata already written
src/lib/utils/avatar.ts — avatarColor(userId) already written
supabase/migrations/001_initial.sql — full schema reference
AGENTS.md — MUST read before writing Next.js code
node_modules/next/dist/docs/ — Next.js 15 docs (breaking changes)

---

## Patterns Observed

- Library layer is complete and idiomatic — do not refactor it
- No UI components exist — build from scratch using Tailwind utility classes
- All types are in one file (src/types/index.ts) — extend it, do not create parallel type files
- Slack notifications are fire-and-forget (async, no await needed in Route Handlers unless you need the result)
- Route Handlers should use createServerSupabaseClient() to get the authenticated user, never trust client-supplied user IDs

---

## Open Questions

1. **Shadcn/ui or raw Tailwind?** The repo has no component library installed. Recommend raw Tailwind for consistency with the existing lib files, but this decision should be made before PR-02.

What is stronger for nicer ui? Can we make the decision later, I dont have component library to go off yet. 

2. **Optimistic UI?** Should vote/raise-hand update the UI before the API responds? Simpler to skip for Phase 1 and add in Phase 2. 

Take the cleaner long term path, 

3. **Real-time?** Supabase supports real-time subscriptions. Not in scope for Phase 1 — use standard fetch.

Subscriptions? I trustt you to make the right calll

---

## Parallel Execution Windows

These PRs can be run in parallel after PR-01 merges:

Window 1 (Opus): PR-01 — Auth Shell (MUST complete first, all others depend on it)

After PR-01 merges to develop:
Window 2 (Sonnet): PR-02 + PR-03 — ProjectCard + Discovery Board (sequential, PR-03 needs PR-02)
Window 3 (Sonnet): PR-04 + PR-05 — Raise Hand + Vote mechanics (independent API routes)
Window 4 (Sonnet): PR-06 + PR-07 — ProfileCard + My Profile (sequential)

After Window 2 merges:
Window 5 (Sonnet): PR-08 + PR-09 + PR-10 — GitHub preview + Registration form + Needs-help flag

---

## Recommended Start Command

cd /Users/williamlobb/Documents/Repos/OC-Labs
git checkout feat/pr-01-auth-shell

Then in Claude Code:
/draft-plan --from thoughts/shared/research/2026-04-02-1500-infrastructure-complete.md implement PR-01 auth shell
