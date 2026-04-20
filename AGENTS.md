<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project: OC Labs

Internal project discovery and collaboration board for the Omnia Collective — a group of related agencies. Members log in via SSO, browse and vote on internal projects, raise their hand to join, and post milestone updates.

**Production URL:** https://oclabs.space  
**Stack:** Next.js 16.2.2 · React 19 · TypeScript 5 · Tailwind CSS v4 · Supabase (Postgres + Auth) · Vercel

---

## Next.js version: 16.2.2 / React 19

This is Next.js 16 with React 19 — both have breaking changes from common training data.

- Read `node_modules/next/dist/docs/` before writing any Next.js code.
- App Router only. No Pages Router.
- Server Components are the default. Add `"use client"` only when you need browser APIs or event handlers.
- `cookies()` from `next/headers` is async — always `await` it.

---

## Supabase clients

Three clients exist. Use the correct one for the context:

| Client | File | Use when |
|--------|------|----------|
| Browser anon | `src/lib/supabase/client.ts` | Client Components only |
| Server anon | `src/lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers |
| Service role | `src/lib/supabase/admin.ts` | Server-only admin ops (user provisioning, bypassing RLS) |

Never import `src/lib/supabase/admin.ts` from any file that could be bundled client-side.

---

## CoWork integration

CoWork is the source of truth for: `name`, `title`, `brand`, `profile_photo_url`.

- These fields are **read-only** in OC Labs. Do not add write paths for them.
- They are synced on login via `src/lib/cowork/client.ts`.
- `cowork_synced_at` on the `users` table records the last sync time.
- Users may edit: `linkedin_url`, `github_username`, and their skills.

---

## Environment variables

| Variable | Required | Used in |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser + server anon clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `src/lib/supabase/admin.ts` — server only |
| `COWORK_API_URL` | Optional (not live yet) | `src/lib/cowork/client.ts` — omit until CoWork API is available |
| `COWORK_API_KEY` | Optional (not live yet) | `src/lib/cowork/client.ts` — omit until CoWork API is available |
| `RESEND_API_KEY` | Yes | Email digest — `src/lib/email/digest.ts` |
| `RESEND_FROM` | Yes | Sender address for digest emails |
| `CRON_SECRET` | Yes | Secures POST /api/cron/digest against unauthenticated calls |
| `GITHUB_TOKEN` | Optional | `src/lib/github/repo.ts` — raises API rate limit from 60 to 5000 req/hr |
| `SLACK_WEBHOOK_PROJECTS` | Optional | Project creation + join notifications |
| `SLACK_WEBHOOK_WINS` | Optional | Milestone update notifications |

Create `.env.local` from `.env.local.example` before running `npm run dev`.

---

## App Router structure

```
src/app/
  (auth)/          # Login page, OAuth callback — public routes
  (app)/           # Main board — requires auth
  api/v1/          # REST API route handlers
```

The middleware at `src/lib/supabase/middleware.ts` redirects unauthenticated users to `/login`.
Routes under `(auth)/` and `/auth/` are exempt from the redirect.

---

## Components

```
src/components/
  board/     # ProjectCard, BoardToolbar, FilterChips
  profile/   # ProfileCard, Avatar
  ui/        # Shared primitives (Button, Badge, etc.)
```

- Use `clsx` + `tailwind-merge` for conditional class names. Wire them into a `cn()` utility at `src/lib/utils/cn.ts`.
- Prefer Server Components. Add `"use client"` only for interactivity or browser APIs.
- Avatar colors are deterministic — use `avatarColor(userId)` from `src/lib/utils/avatar.ts`.

---

## Database rules

- `projects.vote_count` is a denormalized counter. Do not `UPDATE` it directly.
  Increment/decrement via a Supabase RPC or database trigger to avoid race conditions.
- All tables have RLS enabled. Use the anon client for user-facing reads/writes.
  The service role client bypasses RLS — use it only for admin operations.
- Migration files live in `supabase/migrations/`. Name new files `NNN_description.sql`.

---

## Git workflow

| Branch | Purpose |
|--------|---------|
| `main` | Production — protected, requires PR + review |
| `develop` | Integration branch |
| `phase/1-mvp` | Phase 1 feature work |

Phase 1 PRs are implemented in order (PR-01 through PR-10). See README for the full list.
Always branch from `develop`, not `main`.

### Commit checkpoints

After completing each PR unit of work (all files for that PR are written and `npm run lint` passes):

1. Stage only the files for that PR — do not batch multiple PRs into one commit
2. Commit immediately with a scoped message: `feat(pr-NN): short description`
3. Do not leave work as unstaged changes while moving on to the next PR

**Never** let a multi-PR session end with a single large unstaged diff.

---

## Commands

```bash
npm run dev    # Start dev server on :3000
npm run build  # Production build
npm run lint   # ESLint (run before committing)
```

No test framework is installed yet. Lint is the only automated check.

---

## Known issues

- `next.config.ts` must have `images.remotePatterns` configured for any external image domain
  (CoWork photo host, GitHub avatars) before using `<Image>` with external `src` values.
- `projects.vote_count` has no increment RPC yet — do not write direct UPDATE queries against it.
