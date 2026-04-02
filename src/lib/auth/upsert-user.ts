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
