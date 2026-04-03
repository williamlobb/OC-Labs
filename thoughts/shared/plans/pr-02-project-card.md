# Plan: PR-02 ProjectCard Component

**Date**: 2026-04-03
**Branch**: `feat/pr-02-project-card`
**Target**: `develop`

---

## Decisions Locked

| Decision | Choice | Rationale |
|---|---|---|
| Component type | `'use client'` Client Component | Has interactive callbacks (`onVote`, `onJoin`, `onClick`) |
| Status badge colors | Tailwind classes via lookup map, not inline styles | Project convention: Tailwind utility classes only |
| Click propagation | `e.stopPropagation()` on Vote and Join buttons | Card-level `onClick` must not fire when interacting with buttons |
| Description truncation | Tailwind `line-clamp-2` | CSS-only, no JS truncation needed |
| File placement | `src/components/projects/ProjectCard.tsx` (existing stub) | Matches project convention |
| Test placement | `src/test/unit/components/ProjectCard.test.tsx` | Matches existing test layout |
| Types | Import `ProjectCardProps` from `@/types` | Convention: no new type files |
| Classname merging | Import `cn` from `@/lib/utils/cn` | Already exists |

---

## Context Summary

The `ProjectCardProps` interface and all supporting types (`ProjectStatus`, `AvatarColor`) are already defined in `src/types/index.ts`. The utility functions `cn()` and `avatarColor()` exist. The component file is a stub comment. The test infrastructure (vitest + testing-library + msw) is configured, and the `GitHubButton` test provides the exact mocking pattern (`vi.hoisted`) to follow.

---

## File Summary

| Action | File Path |
|---|---|
| MODIFY | `src/components/projects/ProjectCard.tsx` |
| CREATE | `src/test/unit/components/ProjectCard.test.tsx` |
| MODIFY | `vitest.config.ts` |

---

## Phase 1: Implement ProjectCard Component

### Goal
Build the complete presentational `ProjectCard` component with all visual elements and interactive behavior.

### Files
- `src/components/projects/ProjectCard.tsx` — replace stub with full implementation

### Implementation Notes

**Exports**: `export function ProjectCard(props: ProjectCardProps)` — named export, no default.

**Status badge color map**: Define a `const STATUS_STYLES: Record<ProjectStatus, string>` inside the file:
- `'Idea'` → `'bg-blue-100 text-blue-700'`
- `'In progress'` → `'bg-amber-100 text-amber-700'`
- `'Needs help'` → `'bg-red-100 text-red-700'`
- `'Paused'` → `'bg-zinc-100 text-zinc-500'`
- `'Shipped'` → `'bg-green-100 text-green-700'`

**Component structure** (top to bottom inside a single `<article>` element):

1. **Outer `<article>`** — `role="article"`, `onClick={props.onClick}`, `cursor-pointer`, `rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900`. When `needsHelp` is true, add `ring-2 ring-red-400`.

2. **Header row** (flex, items-center, justify-between):
   - Status badge: `<span>` with `STATUS_STYLES[status]` classes, `rounded-full px-2.5 py-0.5 text-xs font-medium`
   - Brand label: `<span className="text-xs text-zinc-500">` displaying `brand`

3. **"Needs help" banner** — conditionally rendered `<div>` when `needsHelp === true`. Text: `"Needs help"`. Classes: `mt-2 rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300`. Use `data-testid="needs-help-banner"` for test targeting.

4. **Title**: `<h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">`

5. **Description**: `<p className="mt-1 text-sm text-zinc-600 line-clamp-2 dark:text-zinc-400">`

6. **Skills tags** (flex, flex-wrap, gap-1.5, mt-3): Map `skills` to `<span>` chips with `rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`.

7. **Footer row** (flex, items-center, justify-between, mt-4, pt-3, border-t border-zinc-100 dark:border-zinc-800):
   - **Left side** — Owner avatar: a `<div>` circle (`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium`) with `style={{ backgroundColor: owner.avatarColor.bg, color: owner.avatarColor.fg }}` (inline style acceptable here — dynamic data, not a design token). Display initials from `getInitials(owner.name)`. Next to it, owner name in `<span className="ml-2 text-sm text-zinc-600">`.
   - **Right side** — two buttons in a flex row with `gap-2`:
     - **Vote button**: `<button aria-label="Vote">`. Shows chevron-up SVG icon + `voteCount`. When `hasVoted`: `text-blue-600 font-semibold`; otherwise `text-zinc-500`. `onClick`: `e.stopPropagation()` then `props.onVote()`.
     - **Join button**: `<button>`. Text `"Joined"` when `hasJoined`, `"Join"` otherwise. When `hasJoined`: `bg-blue-100 text-blue-700`; otherwise `bg-zinc-100 text-zinc-700 hover:bg-zinc-200`. `onClick`: `e.stopPropagation()` then `props.onJoin()`.

**Initials helper**: Local function `function getInitials(name: string): string` — splits on whitespace, takes up to 2 parts, returns first char of each uppercased. Returns `'?'` if name is empty.

**No data fetching, no Supabase imports, no side effects.**

### Failure Modes
- Forgetting `'use client'` will cause a build error.
- `line-clamp-2` is built-in to Tailwind v4 (no plugin needed). If it doesn't work, fall back to `overflow-hidden` + fixed `max-h`.
- Inline `style` for avatar is intentional. Do NOT use Tailwind arbitrary values with template literals — they are not JIT-safe.

---

## Phase 2: Tests and Coverage Config

### Goal
Full test coverage for ProjectCard behavior; add component to vitest coverage tracking.

### Files
- `src/test/unit/components/ProjectCard.test.tsx` — CREATE
- `vitest.config.ts` — MODIFY: add `'src/components/projects/ProjectCard.tsx'` to the `coverage.include` array

### Test File Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectCard } from '@/components/projects/ProjectCard'
import type { ProjectCardProps } from '@/types'
```

No mocks needed — zero external dependencies. All behavior is driven by props.

**`baseProps` factory** returning complete `ProjectCardProps` with sensible defaults:
```typescript
const baseProps = (): ProjectCardProps => ({
  id: 'proj-1',
  title: 'Test Project',
  brand: 'Omnia Creative',
  status: 'Idea',
  desc: 'A test project description',
  skills: ['React', 'TypeScript'],
  owner: { id: 'user-1', name: 'Jane Doe', avatarColor: { bg: '#EEEDFE', fg: '#3C3489' } },
  voteCount: 5,
  hasVoted: false,
  hasJoined: false,
  needsHelp: false,
  onVote: vi.fn(),
  onJoin: vi.fn(),
  onClick: vi.fn(),
})
```

Re-create callbacks as fresh `vi.fn()` inside the factory (not in `beforeEach`) to ensure isolation per test.

### Test Cases

**`describe('rendering')`**
- `it('renders the project title')` — `screen.getByRole('heading', { name: 'Test Project' })`
- `it('renders the description')` — `screen.getByText('A test project description')`
- `it('renders the brand label')` — `screen.getByText('Omnia Creative')`
- `it('renders skill tags')` — `screen.getByText('React')` and `screen.getByText('TypeScript')`
- `it('renders owner initials')` — `screen.getByText('JD')`
- `it('renders owner name')` — `screen.getByText('Jane Doe')`
- `it('renders the vote count')` — `screen.getByText('5')`

**`describe('status badge')`**
- `it.each` over all 5 `ProjectStatus` values — render with each status, assert `screen.getByText(status)` is present

**`describe('needs help banner')`**
- `it('shows needs-help banner when needsHelp is true')` — `screen.getByTestId('needs-help-banner')`
- `it('hides needs-help banner when needsHelp is false')` — `screen.queryByTestId('needs-help-banner')` is null

**`describe('vote button')`**
- `it('displays vote count')`
- `it('shows toggled style when hasVoted is true')` — vote button has class `text-blue-600`
- `it('calls onVote when clicked')` — `userEvent.click`, assert `onVote` called once
- `it('does not call onClick when vote button is clicked')` — click vote button, `onClick` NOT called

**`describe('join button')`**
- `it('shows "Join" when hasJoined is false')` — `screen.getByRole('button', { name: 'Join' })`
- `it('shows "Joined" when hasJoined is true')` — `screen.getByRole('button', { name: 'Joined' })`
- `it('calls onJoin when clicked')` — `userEvent.click`, assert `onJoin` called once
- `it('does not call onClick when join button is clicked')` — click join button, `onClick` NOT called

**`describe('card click')`**
- `it('calls onClick when the card is clicked')` — click `screen.getByRole('article')`, assert `onClick` called once

### Failure Modes
- MSW is configured globally but ProjectCard has no network calls — no `onUnhandledRequest` errors expected.
- If `getByRole('article')` fails in jsdom, ensure the `<article>` tag has explicit `role="article"` attribute.

---

## Rejected Alternatives

- **Storybook**: Not installed; out of scope.
- **Server Component with data fetching**: Rejected — card is purely presentational, reused across PR-03/08/09.
- **Separate `StatusBadge` sub-component**: Only 3 lines of JSX, single consumer. Extract later if reuse emerges.
- **CSS modules for status colors**: Violates project convention (Tailwind only).
- **New type file for `getInitials`**: Convention says extend `src/types/index.ts`. Helper is local-only, stays in component file.

---

## Open Questions

None. All types, utilities, conventions, and infrastructure are in place.
