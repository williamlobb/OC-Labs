import Link from 'next/link'
import { redirect } from 'next/navigation'
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

  const loginHref = `/login?redirectTo=${encodeURIComponent(inviteRedirect)}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-zinc-900 dark:text-zinc-50">Create account</h1>
        <p className="mt-1 text-sm text-zinc-500">Use your invitation email to finish joining OC Labs</p>
      </div>

      <SignupFormInner redirectTo={inviteRedirect} />

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href={loginHref} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
          Sign in
        </Link>
      </p>
    </div>
  )
}
