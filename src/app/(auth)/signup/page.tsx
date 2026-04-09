import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GitHubButton } from '@/components/auth/GitHubButton'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { extractInvitationTokenFromRedirect } from '@/lib/utils/invitations'
import { SignupFormInner } from './SignupFormInner'

interface SearchParams {
  redirectTo?: string
  next?: string
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { redirectTo, next } = await searchParams
  const inviteRedirect = redirectTo ?? next
  const inviteToken = extractInvitationTokenFromRedirect(inviteRedirect)

  if (!inviteRedirect || !inviteToken) {
    redirect('/login')
  }

  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from('role_invitations')
    .select('email, accepted_at')
    .eq('token', inviteToken)
    .maybeSingle()

  if (invitationError || !invitation) {
    redirect('/login')
  }

  const loginHref = `/login?mode=signin&redirectTo=${encodeURIComponent(inviteRedirect)}`

  if (invitation.accepted_at !== null) {
    redirect(loginHref)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-zinc-900 dark:text-zinc-50">Create account</h1>
        <p className="mt-1 text-sm text-zinc-500">Use this invite to create your OC Labs account.</p>
      </div>

      <SignupFormInner redirectTo={inviteRedirect} invitedEmail={invitation.email} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-zinc-400 dark:bg-zinc-900">or</span>
        </div>
      </div>

      <GitHubButton redirectTo={inviteRedirect} />

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href={loginHref} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
          Sign in
        </Link>
      </p>
    </div>
  )
}
