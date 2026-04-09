import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPlatformRole, isPowerUser } from '@/lib/auth/permissions'
import { SettingsNav } from '@/components/settings/SettingsNav'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await getPlatformRole(supabase, user.id)
  const powerUser = isPowerUser(role)

  return (
    <div className="flex gap-10">
      <SettingsNav isPowerUser={powerUser} />
      <div className="flex-1 min-w-0 py-1">
        {children}
      </div>
    </div>
  )
}
