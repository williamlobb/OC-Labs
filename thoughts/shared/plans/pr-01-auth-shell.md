# Plan: PR-01 Auth Shell

**Date**: 2026-04-02
**Research**: `thoughts/shared/research/2026-04-02-1500-infrastructure-complete.md`
**Branch**: `feat/pr-01-auth-shell`
**Target**: `develop`

---

## Decisions Locked

| Question | Decision | Reasoning |
|----------|----------|-----------|
| Email confirmation | Disabled (quick confirm) | signUp returns session immediately — no "check your email" limbo |
| Auth UX | Server Actions for email flows | No client-side state, errors return inline, no page juggling |
| GitHub OAuth | Small `GitHubButton` client component | OAuth MUST redirect to GitHub — unavoidable, but isolated |
| User row creation | Shared `upsertUser()` helper | Called from both signup Server Action and generic callback route |
| Auth callback | Single generic `/auth/callback/route.ts` | Handles email confirm codes AND OAuth codes — one place |
| Open questions | All resolved | See Rejected Alternatives |

---

## Context Summary

Supabase lib layer is fully written — do not touch it. Route group is `(app)` (not `(board)`). Next.js 16.2.2. `cookies()` is async. `public.users` has no INSERT RLS policy — use `supabaseAdmin` for user row creation.

---

## File Summary

| Action  | File Path |
|---------|-----------|
| CREATE  | `middleware.ts` (root) |
| CREATE  | `src/lib/utils/cn.ts` |
| CREATE  | `src/lib/auth/upsert-user.ts` |
| CREATE  | `src/app/(auth)/layout.tsx` |
| REPLACE | `src/app/(auth)/login/page.tsx` |
| CREATE  | `src/app/(auth)/signup/page.tsx` |
| CREATE  | `src/app/auth/callback/route.ts` |
| REPLACE | `src/app/page.tsx` |

**DO NOT MODIFY**: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/admin.ts`, `src/lib/supabase/middleware.ts`, `src/types/index.ts`, `src/app/layout.tsx`

---

## Phase 1: Root Middleware + Auth Layout + Utilities

**Goal**: Wire auth guard, create centered layout shell, add shared helpers.

### 1a. `middleware.ts` (root)

```typescript
import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // /signup is a public auth route — exempt before updateSession runs
  if (request.nextUrl.pathname === '/signup') {
    return NextResponse.next()
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 1b. `src/lib/utils/cn.ts`

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

### 1c. `src/lib/auth/upsert-user.ts`

Shared helper called from both the signup Server Action and the generic callback route. Uses `supabaseAdmin` because `public.users` has no INSERT RLS policy.

```typescript
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { User } from '@supabase/supabase-js'

export async function upsertUser(authUser: User): Promise<void> {
  const name =
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.user_metadata?.user_name ||
    authUser.email?.split('@')[0] ||
    'Unknown'

  const { error } = await supabaseAdmin.from('users').upsert(
    {
      id: authUser.id,
      email: authUser.email!,
      name,
    },
    { onConflict: 'id' }
  )

  if (error) {
    throw new Error(`Failed to upsert user: ${error.message}`)
  }
}
```

### 1d. `src/app/(auth)/layout.tsx`

Server component. Centered card, no nav, OC Labs wordmark.

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            OC Labs
          </span>
          <p className="text-sm text-zinc-500 mt-1">Omnia Collective</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
```

### 1e. `src/app/page.tsx`

```typescript
import { redirect } from 'next/navigation'
export default function Home() {
  redirect('/discover')
}
```

### Phase 1 Tests
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Visiting `/discover` unauthenticated → redirects to `/login?redirectTo=/discover`
- [ ] Visiting `/login` unauthenticated → no redirect loop
- [ ] Visiting `/signup` unauthenticated → renders (no redirect)
- [ ] Visiting `/` → redirects to `/discover`

---

## Phase 2: Login Page

**Goal**: Email/password login via Server Action + GitHub OAuth via isolated client component. No page juggling, errors inline.

### Architecture

```
LoginPage (server component, default export)
├── LoginForm (server component with <form> + action)
│   └── Server Action: loginAction(formData)
└── GitHubButton (client component — 'use client')
```

### `src/app/(auth)/login/page.tsx`

**Server Action `loginAction`**:
- Reads `email`, `password`, `redirectTo` from `FormData`
- `const supabase = await createServerSupabaseClient()`
- `const { error } = await supabase.auth.signInWithPassword({ email, password })`
- On error: return `{ error: error.message }` (re-render with inline message)
- On success: `redirect(redirectTo || '/discover')`

**`LoginPage`** (default export, server component):
- Reads `searchParams.redirectTo` to pass through to form hidden input and GitHub button
- Renders heading, LoginForm, divider, GitHubButton, "sign up" link

**`LoginForm`** (server component with `<form action={loginAction}>`):
- Hidden input for `redirectTo`
- Email input, password input
- Submit button
- Inline error display if `searchParams.error` is set (or returned state)
- Uses `useFormState` / `useActionState` hook — needs `'use client'` wrapper for the form feedback pattern

**Note on useFormState**: To show inline Server Action errors without a page reload, the form component needs `'use client'` + `useActionState`. Split as follows:
- `LoginFormInner` — `'use client'`, uses `useActionState(loginAction, null)`, renders form with inline error
- `loginAction` — defined in a separate `src/app/(auth)/login/actions.ts` file (Server Actions must be in `'use server'` files or marked with the directive)

**`GitHubButton`** (`'use client'`):
- Receives `redirectTo` as prop
- `onClick`: `supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: callbackUrl } })`
- Callback URL: `new URL('/auth/callback', window.location.origin)` + `?next=${redirectTo || '/discover'}`
- `Github` icon from `lucide-react`

### Files for Phase 2:
- `src/app/(auth)/login/page.tsx` — Page component
- `src/app/(auth)/login/actions.ts` — `loginAction` Server Action (`'use server'`)
- `src/components/auth/GitHubButton.tsx` — GitHub OAuth button client component

### Phase 2 Tests
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Valid credentials → redirect to `/discover`
- [ ] Invalid credentials → inline error, no page reload
- [ ] GitHub button → redirects to GitHub OAuth flow
- [ ] `redirectTo=/projects/new` query param → preserved through email login
- [ ] `redirectTo` preserved in GitHub OAuth callback URL as `?next=` param

---

## Phase 3: Signup Page

**Goal**: Email/password signup that immediately creates session + `public.users` row (no email confirmation step).

### Architecture

Same pattern as login. Server Action handles signup.

### `src/app/(auth)/signup/actions.ts` — Server Action

**`signupAction(formData)`**:
1. Read `name`, `email`, `password` from FormData
2. Validate: name non-empty, email valid, password >= 6 chars
3. `const supabase = await createServerSupabaseClient()`
4. `const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })`
5. On error: return `{ error: error.message }`
6. `const { data: { user } } = await supabase.auth.getUser()`
7. If user: `await upsertUser(user)` — creates `public.users` row immediately
8. `redirect('/discover')`

### `src/app/(auth)/signup/page.tsx`

- `SignupFormInner` (`'use client'`, `useActionState`) — name, email, password inputs, inline error
- `SignupPage` (default export) — wraps form, "sign in" link

### Files for Phase 3:
- `src/app/(auth)/signup/page.tsx`
- `src/app/(auth)/signup/actions.ts`

### Phase 3 Tests
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Valid signup → immediate redirect to `/discover`
- [ ] Short password → inline validation error
- [ ] After signup, `public.users` row exists with correct id, email, name
- [ ] "Sign in" link → `/login`

---

## Phase 4: Generic Auth Callback Route

**Goal**: Single route handles ALL auth code exchanges (GitHub OAuth, email magic links, future providers). Upserts `public.users` row.

### `src/app/auth/callback/route.ts`

```typescript
export async function GET(request: NextRequest): Promise<NextResponse>
```

Logic:
1. `const code = request.nextUrl.searchParams.get('code')`
2. `const next = request.nextUrl.searchParams.get('next') || '/discover'`
3. If no code: `redirect('/login')`
4. `const supabase = await createServerSupabaseClient()`
5. `const { error } = await supabase.auth.exchangeCodeForSession(code)`
6. If error: `redirect('/login')`
7. `const { data: { user } } = await supabase.auth.getUser()`
8. If user: `await upsertUser(user)` (from `@/lib/auth/upsert-user`)
9. `redirect(next)`

**Note**: `next` param is set by `GitHubButton` when building the OAuth redirectTo URL. For email confirmation flows (if ever re-enabled), the confirmation link redirects here with just `code`.

### Phase 4 Tests
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Completing GitHub OAuth → lands on `/discover` with valid session
- [ ] After GitHub OAuth, `public.users` row exists with correct id, email, name
- [ ] `/auth/callback` with no code param → redirects to `/login`
- [ ] `/auth/callback?next=/projects/new` → redirects to `/projects/new` after auth

---

## Pre-PR Checklist

Before marking PR ready:
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — successful
- [ ] `npm run lint` — clean
- [ ] All manual test cases above pass
- [ ] No hardcoded secrets or user IDs
- [ ] No console.log statements

---

## Rejected Alternatives

- **Client-side auth forms**: useState + supabase browser calls. More moving parts, requires 'use client' throughout, harder to test. Server Actions give us server-side validation and simpler error handling.
- **'use client' login page with useSearchParams**: Requires Suspense boundary, adds boilerplate. Server component page + 'use client' form inner is cleaner split.
- **Per-provider callback routes** (e.g., `/auth/callback/github`): Harder to extend to future providers. Single `/auth/callback` is idiomatic Supabase pattern.
- **Creating public.users on client-side**: Would require exposing supabaseAdmin to client or adding a separate API call. Server Action handles it atomically.
- **Shadcn/ui**: Not installed, deferred. Raw Tailwind keeps dependency count down for Phase 1.
- **Modifying src/lib/supabase/middleware.ts**: Handle /signup exemption in root middleware instead. Protects the shared lib layer.

---

## Dependency Notes

- No dependencies on other PRs
- PRs 02–10 all unblock after this merges
