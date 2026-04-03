import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function verifyApiKey(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey) return null

  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const { data: apiKey } = await supabaseAdmin
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .single()

  if (!apiKey) return null

  // Update last_used_at — fire and forget
  supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then(() => {})

  return apiKey.user_id
}
