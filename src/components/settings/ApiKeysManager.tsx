'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { ApiKey } from '@/types'

interface ApiKeysManagerProps {
  initialKeys: ApiKey[]
}

export function ApiKeysManager({ initialKeys }: ApiKeysManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (creating) return
    setCreating(true)
    setError('')
    setNewKey(null)

    try {
      const res = await fetch('/api/v1/users/me/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || null }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create key.')
        return
      }

      const data = await res.json()
      setNewKey(data.key)
      setLabel('')
      // Add to list without the raw key
      setKeys((prev) => [
        { id: data.id, user_id: '', label: data.label, created_at: data.created_at },
        ...prev,
      ])
    } catch {
      setError('Something went wrong.')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(keyId: string) {
    const res = await fetch(`/api/v1/users/me/api-keys/${keyId}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
      if (newKey) setNewKey(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <form
        onSubmit={handleCreate}
        className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          New API key
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={creating}
            className={cn(
              'rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200',
              creating && 'opacity-60 cursor-not-allowed'
            )}
          >
            Create
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </form>

      {/* Newly created key — shown once */}
      {newKey && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <p className="mb-2 text-sm font-medium text-green-800 dark:text-green-200">
            Copy this key — it won&apos;t be shown again.
          </p>
          <code className="block break-all rounded bg-white px-3 py-2 text-xs font-mono text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
            {newKey}
          </code>
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <p className="text-sm text-zinc-500">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {key.label ?? 'Unnamed key'}
                </p>
                <p className="text-xs text-zinc-400">
                  Created {new Date(key.created_at).toLocaleDateString()}
                  {key.last_used_at &&
                    ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="text-xs text-zinc-400 hover:text-red-600 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
