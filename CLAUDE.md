@AGENTS.md

# OC Labs — Claude Code Conventions

## Pipeline

This project uses the context engineering pipeline:
1. `/research [topic]` → saves to thoughts/shared/research/
2. `/draft-plan [task] --from [research-artifact]` → saves to thoughts/shared/plans/
3. `/implement [plan-path]` → phases with test gates
4. `/checkpoint` → tests → commit → update memory/core.md

Always start a new task with `/research` or `/draft-plan --from` an existing artifact.
Never implement directly from a user request without a plan file.

## Project Conventions

### File placement
- Route: src/app/(auth)/ or src/app/(board)/ — never under src/app/ directly
- API: src/app/api/v1/[resource]/route.ts
- Components: src/components/[board|profile|ui]/
- Types: extend src/types/index.ts — do not create new type files
- Lib: extend existing files in src/lib/ — do not create parallel clients

### Supabase access pattern
- Server Components → createServerSupabaseClient() from src/lib/supabase/server.ts
- Route Handlers (user-scoped) → createServerSupabaseClient()
- Route Handlers (admin/bypass RLS) → supabaseAdmin from src/lib/supabase/admin.ts
- Client Components → supabase from src/lib/supabase/client.ts (read-only, no mutations)
- NEVER import admin client in Server Components or client components

### Auth pattern
- Get current user in Route Handler: const { data: { user } } = await supabase.auth.getUser()
- Never trust client-supplied user IDs — always derive from session
- Return 401 if !user

### Next.js 15 specifics
- cookies() is async — must await it
- use() for context in Server Components
- fetch() has built-in caching — use next: { revalidate: N } for ISR
- Route Handlers export named functions: export async function GET/POST/PUT/DELETE

### Styling
- Tailwind utility classes only — no CSS modules, no inline styles
- No shadcn/ui (not installed) — build atoms in src/components/ui/
- Design tokens: zinc scale for neutrals, existing Tailwind defaults for accent colours

## Build Commands

npm run dev          — start dev server (localhost:3000)
npm run build        — production build
npm run lint         — ESLint
npx tsc --noEmit     — TypeScript check (run before every commit)

## Security Rules (enforced by /implement pipeline)

- No service role key in client-side code ever
- No user ID from request body — always from session
- Route Handlers must validate input before DB writes
- Never expose Supabase service role key in API responses
