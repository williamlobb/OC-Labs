import { Suspense } from 'react'
import { SignupFormInner } from './SignupFormInner'
import Link from 'next/link'

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-zinc-900 dark:text-zinc-50">Create account</h1>
        <p className="mt-1 text-sm text-zinc-500">Join OC Labs</p>
      </div>

      <Suspense fallback={null}>
        <SignupFormInner />
      </Suspense>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
          Sign in
        </Link>
      </p>
    </div>
  )
}
