import { Suspense } from 'react'
import Link from 'next/link'
import { GitHubButton } from '@/components/auth/GitHubButton'
import { isInvitationRedirect } from '@/lib/utils/invitations'
import { LoginFormInner } from './LoginFormInner'

interface SearchParams {
  redirectTo?: string
  next?: string
  error?: string
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { redirectTo, next, error } = await searchParams
  const safeRedirect = redirectTo ?? next
  const showInviteSignup = isInvitationRedirect(safeRedirect)
  const signupHref = showInviteSignup && safeRedirect
    ? `/signup?redirectTo=${encodeURIComponent(safeRedirect)}`
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-zinc-900 dark:text-zinc-50">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-500">Welcome back to OC Labs</p>
      </div>

      {error === 'not_invited' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>Access restricted.</strong> OC Labs is currently invite-only. Contact a Power User to request an invitation.
        </div>
      )}

      <Suspense fallback={null}>
        <LoginFormInner redirectTo={safeRedirect} />
      </Suspense>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-zinc-400 dark:bg-zinc-900">or</span>
        </div>
      </div>

      <GitHubButton redirectTo={safeRedirect} />

      {signupHref && (
        <p className="text-center text-sm text-zinc-500">
          Need an account?{' '}
          <Link href={signupHref} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
            Create one with this invite
          </Link>
        </p>
      )}

    </div>
  )
}
