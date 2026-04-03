import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiKeysManager } from '@/components/settings/ApiKeysManager'
import type { ApiKey } from '@/types'

export default async function ApiKeysPage() {
  const supabase = await createServerSupabaseClient()

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, label, created_at, last_used_at')
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">API Keys</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Use API keys to post project updates from agents or external tools.
        </p>
      </div>
      <ApiKeysManager initialKeys={(keys ?? []) as ApiKey[]} />
    </div>
  )
}
