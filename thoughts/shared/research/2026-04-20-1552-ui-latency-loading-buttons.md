# Research: UI Latency, Loading States & Button Interactions
**Date**: 2026-04-20 15:52
**Scope**: All routes in src/app/(app)/, all components in src/components/, all API handlers in src/app/api/v1/

---

## Key Findings

### 1. No `loading.tsx` files exist anywhere in the app
Every route blocks the entire render until all server-side awaits resolve. The only `<Suspense>` boundary in the app is in `(auth)/login/page.tsx:45-47` with `fallback={null}` — providing no visual feedback at all.

### 2. `router.refresh()` is the primary UI latency culprit
Called after nearly every mutation, it triggers a full server re-render. On the discover page this means re-running 3–4 Supabase queries before the UI unlocks:
- `FilterableBoard.tsx:132` — after vote
- `FilterableBoard.tsx:179` — after join
- `PostUpdateForm.tsx:57` — after posting update
- `ProjectForm.tsx:167` — after deletion
- `SubmissionsQueuePanel.tsx:48` — after approval/rejection
- `PlatformRolesPanel.tsx:42` — after role change

Contrast with `ProjectActions.tsx` (lines 32–57), which already does **optimistic UI updates with rollback** — that's the correct pattern and should be applied everywhere.

### 3. Sequential awaits on many pages create unnecessary waterfalls
Pages that could parallelize their DB calls don't:
- `profile/me/page.tsx` — 3 sequential queries (user → skills → memberships)
- `profile/[id]/page.tsx` — same sequential pattern
- `projects/new/page.tsx` — 3 sequential permission checks
- `discover/page.tsx` — auth → platformRole → projects → conditional team members (3 queries before content renders)
- App layout itself blocks on sequential auth → role check on every route

### 4. A `SkeletonCard` component already exists but is never used
`src/components/ui/SkeletonCard.tsx` — complete with `animate-pulse` — sits unused. No `loading.tsx` files exist to deploy it.

### 5. Middleware runs `supabase.auth.getUser()` on every request
`src/lib/supabase/middleware.ts:36` — adds 100–500ms to every route transition. This is unavoidable for auth but compounds with page-level waterfalls.

### 6. Button interaction gaps
- **FilterChips** (`src/components/board/FilterChips.tsx:16–40`): No `active:` or `focus:ring-*` states
- **ProjectTabs** (`src/components/projects/ProjectTabs.tsx:34–46`): No `focus:ring-*`
- **Vote/Join buttons in ProjectCard** (`src/components/projects/ProjectCard.tsx:123–145`): Missing `cursor-pointer`
- **TaskCard block/agent toggle buttons** (`src/components/plan/TaskCard.tsx:215–250`): Missing `cursor-pointer` on inactive state; look disabled but are clickable
- **Text edit/delete buttons** in `ContextBlockList.tsx:79–91` and `UpdatesFeed.tsx:192–209`: Only text color changes on hover — no background highlight. Makes them feel unresponsive.
- **SignOutButton** (`src/components/auth/SignOutButton.tsx:15–21`): No `active:` state.

### 7. Buttons that ARE correctly implemented (don't touch)
- `ProjectActions.tsx` — optimistic updates, pending flags ✓
- `PostUpdateForm.tsx` — "Posting…" loading state ✓
- `TaskCard.tsx` status button — `cursor-not-allowed opacity-50` when disabled ✓
- `HandRaiseRequests.tsx` — "Approving…"/"Denying…" states ✓
- Form submits in `ProjectForm.tsx`, `EditProfileForm.tsx`, `ContextBlockEditor.tsx` — disabled styling ✓

### 8. Heavy API endpoints that warrant UI loading feedback
- `api/v1/projects/[id]/chat/route.ts` — 55s agent timeout (already streams ✓)
- `api/v1/projects/[id]/plan/route.ts` — Anthropic call, 3–15s (no streaming)
- `api/v1/projects/[id]/github/summary/route.ts` — 2–10s external calls
- `api/v1/projects/[id]/jira/sync/route.ts` — 2–10s external Jira API

### 9. React.cache() wrappers exist but aren't used consistently
`src/lib/data/project-queries.ts` defines `getCachedProject()`, `getCachedPlatformRole()` etc., but some pages still call `createServerSupabaseClient()` and repeat queries directly (e.g., `discover/page.tsx:9` duplicates auth).

---

## Implementation Priority

### Phase 1 — Loading states (highest user-visible impact)
1. Add `loading.tsx` to: `(app)/discover/`, `(app)/projects/[id]/`, `(app)/profile/me/`, `(app)/profile/[id]/`
2. Use existing `SkeletonCard` component in discover loading.tsx
3. Create a `ProjectPageSkeleton` for the project detail loading.tsx

### Phase 2 — Eliminate `router.refresh()` latency
4. Replace `router.refresh()` in `FilterableBoard.tsx` (vote + join) with local state updates (mirror ProjectActions.tsx pattern)
5. Replace `router.refresh()` in `PostUpdateForm.tsx` with local state prepend

### Phase 3 — Button polish
6. Add `active:scale-95 focus:ring-2 focus:ring-zinc-400 focus:outline-none` to FilterChips and ProjectTabs
7. Add `cursor-pointer` to ProjectCard vote/join area and TaskCard toggle buttons
8. Add `hover:bg-zinc-100 dark:hover:bg-zinc-800` to text edit/delete buttons in ContextBlockList + UpdatesFeed
9. Add `active:` state to SignOutButton

### Phase 4 — Query parallelization
10. Parallelize `profile/me/page.tsx` and `profile/[id]/page.tsx` queries with `Promise.all()`
11. Parallelize `projects/new/page.tsx` permission checks

---

## Relevant Files

| File | Issue |
|------|-------|
| `src/components/board/FilterableBoard.tsx:132,179` | `router.refresh()` after vote + join — primary latency source |
| `src/components/projects/PostUpdateForm.tsx:57` | `router.refresh()` after update |
| `src/components/projects/ProjectForm.tsx:167` | `router.refresh()` after deletion |
| `src/components/admin/SubmissionsQueuePanel.tsx:48` | `router.refresh()` after approval |
| `src/components/admin/PlatformRolesPanel.tsx:42` | `router.refresh()` after role change |
| `src/components/projects/ProjectActions.tsx:32–57` | **GOOD PATTERN** — reference for optimistic UI |
| `src/components/ui/SkeletonCard.tsx` | Exists but unused — deploy in loading.tsx |
| `src/components/board/FilterChips.tsx:16–40` | Missing `active:` / `focus:ring` states |
| `src/components/projects/ProjectTabs.tsx:34–46` | Missing `focus:ring` states |
| `src/components/projects/ProjectCard.tsx:123–145` | Missing `cursor-pointer` on vote button |
| `src/components/plan/TaskCard.tsx:215–250` | Missing `cursor-pointer` on inactive toggles |
| `src/components/context/ContextBlockList.tsx:79–91` | Text buttons need bg hover |
| `src/components/projects/UpdatesFeed.tsx:192–209` | Text buttons need bg hover |
| `src/app/(app)/profile/me/page.tsx:13–33` | 3 sequential queries → parallelize |
| `src/app/(app)/projects/new/page.tsx:9–14` | 3 sequential permission checks → parallelize |
| `src/app/(app)/discover/page.tsx:9–78` | Auth waterfall before projects load |
| `src/lib/supabase/middleware.ts:36` | Auth check on every request (unavoidable but compounds) |
| `src/lib/data/project-queries.ts` | Cache wrappers — use these consistently |

---

## Open Questions

1. Should `router.refresh()` be fully removed or can we use `revalidatePath()` from Server Actions for more targeted invalidation?
2. Is there appetite to add `useTransition()` to mutation handlers, which gives React's built-in pending state without full page refresh?
3. For plan generation (3–15s Anthropic call), should we show a streaming progress indicator or poll for completion?
4. Should `loading.tsx` skeletons exactly match the final layout (pixel-perfect skeleton) or use a generic card shimmer?

---

## Raw Agent Outputs

### Agent 1: Loading states & Suspense boundaries
*(Full output incorporated into Key Findings above)*

Key data points:
- 0 `loading.tsx` files found
- 1 `<Suspense>` boundary with `fallback={null}` in login page
- `SkeletonCard.tsx` + `chat-verb-shimmer` CSS exist but are unused in page routing
- `React.cache()` wrappers defined in `project-queries.ts` but not used consistently
- Discover, profile/me, profile/[id] are the highest-risk pages for sequential waterfalls

### Agent 2: Button hover/active audit
*(Full output incorporated into Key Findings above)*

Key data points:
- FilterChips (all filter buttons): no `active:` or `focus:ring-*`
- ProjectTabs: no `focus:ring-*`
- ProjectCard vote button: no `cursor-pointer`
- TaskCard block/agent toggles: no `cursor-pointer` in inactive state
- ContextBlockList + UpdatesFeed edit/delete: only text color on hover, no bg
- Sign out button: no `active:` state
- Forms (PostUpdateForm, EditProfileForm, ContextBlockEditor, ProjectForm, HandRaiseRequests): all correctly implemented

### Agent 3: Async mutation & router.refresh() analysis
*(Full output incorporated into Key Findings above)*

Key data points:
- `router.refresh()` found in 6 components — all trigger full SSR re-render
- FilterableBoard does optimistic vote/join locally BUT then calls `router.refresh()` — negating the optimism
- ProjectActions.tsx is the reference implementation — optimistic + rollback, no refresh
- Chat endpoints already stream correctly — good UX
- GitHub summary: 2–10s without progress indicator
- Plan generation: 3–15s without progress indicator
- Middleware adds 100–500ms baseline to every route change
