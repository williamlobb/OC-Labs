import Image from 'next/image'
import Link from 'next/link'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const platformRole = user ? await getPlatformRole(supabase, user.id) : 'user'
  const showAdmin = isPowerUser(platformRole)

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/discover"
            className="flex items-center gap-2 font-brand text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            <Image src="/omnia-icon.svg" alt="Omnia logo" width={28} height={28} priority />
            <span>OC Labs</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/discover"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              Discover
            </Link>
            <Link
              href="/profile/me"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              Profile
            </Link>
            <Link
              href="/settings/api-keys"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              Settings
            </Link>
            {showAdmin && (
              <Link
                href="/admin"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              >
                Admin
              </Link>
            )}
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}
