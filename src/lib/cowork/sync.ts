import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchCoWorkProfile } from './client'

export interface CoWorkSyncResult {
  synced: boolean
  error?: string
}

/**
 * Fetch the user's CoWork profile and update the read-only fields in the
 * users table. Called on login and from the CoWork webhook.
 *
 * Login succeeds even if CoWork is unreachable — errors are logged, not thrown.
 */
export async function syncCoWorkProfile(
  userId: string,
  email: string
): Promise<CoWorkSyncResult> {
  const profile = await fetchCoWorkProfile(email)

  if (!profile) {
    console.warn(JSON.stringify({
      event: 'cowork_sync_skipped',
      userId,
      reason: 'CoWork profile not found or API unreachable',
    }))
    return { synced: false, error: 'CoWork profile unavailable' }
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      name: profile.name,
      title: profile.title,
      brand: profile.brand,
      profile_photo_url: profile.profile_photo_url,
      cowork_synced_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    console.error(JSON.stringify({
      event: 'cowork_sync_failed',
      userId,
      error: error.message,
    }))
    return { synced: false, error: error.message }
  }

  return { synced: true }
}

/**
 * Handle a CoWork webhook event. Looks up the user by email and syncs
 * their profile fields. Idempotent — safe to call multiple times.
 */
export async function handleCoWorkWebhook(payload: unknown): Promise<void> {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('email' in payload) ||
    typeof (payload as Record<string, unknown>).email !== 'string'
  ) {
    throw new Error('Invalid webhook payload: missing email field')
  }

  const email = (payload as { email: string }).email

  // Look up user by email
  const { data: user, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (lookupError) {
    console.error(JSON.stringify({
      event: 'cowork_webhook_lookup_failed',
      email,
      error: lookupError.message,
    }))
    throw new Error(lookupError.message)
  }

  if (!user) {
    // User hasn't logged in yet — nothing to sync
    console.info(JSON.stringify({
      event: 'cowork_webhook_user_not_found',
      email,
    }))
    return
  }

  await syncCoWorkProfile(user.id, email)
}

