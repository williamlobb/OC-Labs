---
name: UI/UX abstracts complexity
description: Design principle for the user-facing surface of OC Labs
type: feedback
---

**UI/UX always abstracts complexity away from users.**

When building auth flows, forms, error states, or any user-facing surface:
- Server Actions hide API complexity — users see inline form feedback, no modal juggling
- Error messages are user-friendly, never raw Supabase/system strings
- OAuth never leaves the page unnecessarily — GitHub button is isolated client component; form submission stays on page
- Sensitive operations (user row creation, session exchange) happen silently on the backend — no "check your email" limbo if email confirmation is off
- Defaults are sensible — redirectTo falls back to /discover, GitHub OAuth callback defaults to /discover

**Why**: The auth shell is the first impression of the app. Complex UX (page reloads, opaque errors, "go check your email") loses users. Smooth, magical-feeling auth is worth the backend abstraction.

**How to apply**: When building following PRs (vote, raise hand, create project, etc.), use Server Actions for mutations, keep client components small and dumb, and map all backend errors to 3–4 friendly user messages.
