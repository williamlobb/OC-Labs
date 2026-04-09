'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'

interface User {
  id: string
  name: string | null
  email: string | null
  platform_role: string | null
  profile_photo_url: string | null
}

interface Props {
  users: User[]
}

export default function PlatformRolesPanel({ users }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  async function handleToggleRole(user: User) {
    const newRole = user.platform_role === 'power_user' ? 'user' : 'power_user'
    setLoadingId(user.id)
    setErrorId(null)

    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_role: newRole }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to update role')
      }

      router.refresh()
    } catch {
      setErrorId(user.id)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50">
            <th className="px-4 py-3 text-left font-medium text-zinc-500">User</th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">Email</th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500">Role</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-500">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-zinc-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    userId={user.id}
                    name={user.name ?? user.email ?? 'Unknown'}
                    photoUrl={user.profile_photo_url}
                    size="sm"
                  />
                  <span className="font-medium text-zinc-800">
                    {user.name ?? '(no name)'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-zinc-500">{user.email ?? '—'}</td>
              <td className="px-4 py-3">
                {user.platform_role === 'power_user' ? (
                  <Badge variant="amber">Power User</Badge>
                ) : (
                  <Badge variant="default">User</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {errorId === user.id && (
                  <span className="mr-3 text-xs text-red-500">Update failed</span>
                )}
                <button
                  onClick={() => handleToggleRole(user)}
                  disabled={loadingId === user.id}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                >
                  {loadingId === user.id
                    ? 'Saving…'
                    : user.platform_role === 'power_user'
                      ? 'Make User'
                      : 'Make Power User'}
                </button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
