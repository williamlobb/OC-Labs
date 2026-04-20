# Plan: UI Loading States, Button Polish, and Latency Reduction
**Date**: 2026-04-20
**Research**: `thoughts/shared/research/2026-04-20-1552-ui-latency-loading-buttons.md`
**Phases**: 4

---

## Context Summary
The OC Labs app has zero `loading.tsx` files, so every route blocks until all server queries complete. An existing `SkeletonCard` component at `src/components/ui/SkeletonCard.tsx` uses `animate-pulse` but is never deployed. The primary latency source is `router.refresh()` in `FilterableBoard.tsx` after vote/join mutations, which triggers full SSR re-renders. `ProjectActions.tsx` already demonstrates the correct optimistic update pattern with rollback. Several interactive elements (FilterChips, ProjectTabs, vote buttons, TaskCard toggles) are missing `cursor-pointer`, `active:`, and `focus:ring-*` states.

---

## Phase 1: Loading Skeletons (`loading.tsx` files)
**Goal**: Show shimmer skeletons immediately during route transitions for the highest-traffic routes.

### New files

1. **`src/app/(app)/discover/loading.tsx`**
   Mirrors the discover page layout: a header row with heading + button skeleton, then a 3-column grid of 6 `<SkeletonCard />` instances. Import from `@/components/ui/SkeletonCard`.

2. **`src/components/ui/ProfileSkeleton.tsx`**
   New component matching `ProfileCard` layout: a 64px circle + 3 text bars (name, title, brand), then a skills row of 4 pill skeletons, then a projects list of 3 line skeletons. All using `animate-pulse` and `bg-zinc-200 dark:bg-zinc-700` consistent with SkeletonCard.

3. **`src/app/(app)/profile/me/loading.tsx`**
   Renders `<ProfileSkeleton />` inside `<div className="max-w-2xl space-y-10">` plus a second section skeleton for the "Edit profile" form area.

4. **`src/app/(app)/profile/[id]/loading.tsx`**
   Renders `<ProfileSkeleton />` inside `<div className="max-w-2xl">`.

5. **`src/components/ui/ProjectDetailSkeleton.tsx`**
   New component matching `projects/[id]/page.tsx` layout: a 2-column grid with left column (2/3) showing repos + updates section skeletons. Right column (1/3) showing team + risk section skeletons.

6. **`src/app/(app)/projects/[id]/loading.tsx`**
   Renders `<ProjectDetailSkeleton />`. Sits inside `projects/[id]/layout.tsx` boundary, so header/actions/tabs are already rendered. Skeleton only replaces the `{children}` slot.

7. **`src/app/(app)/settings/loading.tsx`**
   Simple skeleton: a heading bar + 3 rows of settings-shaped placeholders. Sits inside settings layout, so SettingsNav is already rendered.

### Tests
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Visual: navigate to `/discover` with devtools throttled to Slow 3G -- skeleton appears before content
- [ ] Visual: navigate to `/profile/me` -- profile skeleton appears
- [ ] Visual: navigate to `/projects/<any-id>` -- project detail skeleton appears

### Risks
- `loading.tsx` must be a direct child of its route segment directory or it won't trigger
- `projects/[id]/loading.tsx` skeleton must NOT duplicate layout header/actions/tabs

---

## Phase 2: Button Interaction Polish
**Goal**: Add `active:`, `focus:ring-*`, and `cursor-pointer` states to all identified interactive elements.

### Files to change

1. **`src/components/board/FilterChips.tsx`** (lines 18-22, 31-35)
   Add to both the "All" button and each status button:
   `active:scale-95 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-1 cursor-pointer`

2. **`src/components/projects/ProjectTabs.tsx`** (lines 37-42)
   Add to each `<Link>`:
   `focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-1 rounded-t-md`

3. **`src/components/projects/ProjectCard.tsx`** (lines 123-129, 147-161)
   - Vote button: Add `cursor-pointer`
   - Join button: Add `cursor-pointer` to non-disabled branches

4. **`src/components/plan/TaskCard.tsx`** (lines 216-224, 240-249)
   - Block/Unblock button: Add `cursor-pointer`
   - Agent toggle button: Add `cursor-pointer`

5. **`src/components/context/ContextBlockList.tsx`** (lines 79-90)
   - Edit button: Add `rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer`
   - Delete button: Add `rounded px-1.5 py-0.5 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer`

6. **`src/components/projects/UpdatesFeed.tsx`** (lines 192-209)
   - Edit button: Add `rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer`
   - Delete button: Add `rounded px-1.5 py-0.5 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer`

7. **`src/components/auth/SignOutButton.tsx`** (line 16)
   Add `active:opacity-70 cursor-pointer`

### Tests
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Visual: FilterChips show ring on keyboard focus, slight scale on click
- [ ] Visual: ProjectTabs show ring on keyboard tab navigation
- [ ] Visual: Vote button shows pointer cursor on hover
- [ ] Visual: Edit/Delete buttons show background highlight on hover

### Risks
- `active:scale-95` on FilterChips could cause layout shift if chips are tightly packed -- use `active:scale-[0.97]` if so
- `rounded-t-md` on ProjectTabs Links alongside existing border-b may need visual verification

---

## Phase 3: Eliminate `router.refresh()` Latency
**Goal**: Replace `router.refresh()` with optimistic local state updates in FilterableBoard, and wrap remaining refresh calls in `startTransition`.

### Files to change

1. **`src/components/board/FilterableBoard.tsx`**

   **Vote handler (lines 130-133)**:
   - Add `const [localVotes, setLocalVotes] = useState<Record<string, { hasVoted: boolean; voteCount: number }>>({})`
   - Optimistic update: toggle local state immediately, fetch vote endpoint, update from server response on success, revert on error
   - Update `hasVoted` and `voteCount` props passed to `<ProjectCard>` to merge server data with `localVotes[project.id]`
   - Remove `router.refresh()`

   **Join handler (line 179)**:
   - Remove `router.refresh()`. The local state (`localRequestedByProject`, `localJoinedByProject`) at lines 166-177 already provides immediate feedback.

2. **`src/components/projects/PostUpdateForm.tsx`**
   - Add `import { useTransition } from 'react'`
   - Add `const [, startTransition] = useTransition()`
   - Change line 57: wrap `router.refresh()` in `startTransition(() => { router.refresh() })` so form clears instantly while refresh happens in background

### Tests
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Functional: On discover page, click vote -- count updates instantly without page flash
- [ ] Functional: Click vote again to un-vote -- count decrements instantly
- [ ] Functional: Submit join request -- button changes to "Request sent" immediately
- [ ] Functional: Post update on project detail page -- form clears instantly, feed updates after short delay
- [ ] Regression: After voting on discover page, navigate to project detail -- vote state matches

### Risks
- Optimistic vote count could drift if user votes rapidly. Mitigate with `votePending` flag per project.
- Removing `router.refresh()` from join handler means team member previews won't update immediately (acceptable).

---

## Phase 4: Query Parallelization
**Goal**: Parallelize sequential database queries on profile and new project pages.

### Files to change

1. **`src/app/(app)/profile/me/page.tsx`** (lines 13-30)
   After `getUser()`, wrap three subsequent queries in `Promise.all()`:
   ```typescript
   const [{ data: profile }, { data: skills }, { data: memberships }] = await Promise.all([
     supabase.from('users').select('*').eq('id', user.id).single(),
     supabase.from('user_skills').select('skill').eq('user_id', user.id),
     supabase.from('project_members').select('...').eq('user_id', user.id),
   ])
   ```

2. **`src/app/(app)/profile/[id]/page.tsx`** (lines 14-30)
   Same `Promise.all()` pattern for profile, skills, and memberships.

3. **`src/app/(app)/projects/new/page.tsx`** (lines 9-15)
   ```typescript
   const [allowed, platformRole] = await Promise.all([
     canCreateProject(supabase, user.id),
     getPlatformRole(supabase, user.id),
   ])
   ```

### Tests
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Functional: `/profile/me` loads correctly with all data
- [ ] Functional: `/profile/<id>` loads correctly for valid user
- [ ] Functional: `/profile/<invalid-id>` returns 404
- [ ] Functional: `/projects/new` loads correctly for authenticated users

### Risks
- `if (!profile)` redirect/notFound must run AFTER `Promise.all` resolves
- Failed parallel queries are harmless -- unused results from parallel siblings

---

## Rejected Alternatives

- **Full client wrapper for PostUpdateForm + UpdatesFeed**: True optimistic prepend requires extracting both into a client component wrapper. Deferred -- `startTransition(router.refresh())` achieves 80% benefit with 10% effort.
- **`revalidatePath()` via Server Actions**: Requires converting fetch mutations to Server Actions -- larger architectural change. Optimistic local state is more effective.
- **`<Suspense>` boundaries with streaming**: More granular but more complex than `loading.tsx`. Can add later.
- **React Query / SWR**: Large dependency and architectural change for something solvable with local state.
- **Skeleton for every settings sub-route**: Admin-only, low-traffic -- not worth the effort.

---

## Open Questions

1. **Vote drift**: When FilterableBoard uses local vote state, navigating away and back resets to server state (which may lag). Accept the drift, or add background `revalidatePath`? **Recommendation**: Accept -- server catches up on next navigation.

2. **PostUpdateForm full optimistic prepend**: The `startTransition` approach is planned. Should a Phase 5 for full client-wrapper optimistic prepend be planned now or deferred? **Recommendation**: Defer.
