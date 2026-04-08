'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  projectId?: string
}

export default function InviteDialog({ isOpen, onClose, projectId }: Props) {
  const [email, setEmail] = useState('')
  const [projectRole, setProjectRole] = useState<string>('contributor')
  const [platformRole, setPlatformRole] = useState<string>('user')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  // Reset form state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setProjectRole('contributor')
      setPlatformRole('user')
      setStatus('idle')
      setErrorMsg('')
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const body: Record<string, string> = { email }
    if (projectId) {
      body.project_id = projectId
      body.project_role = projectRole
    } else {
      body.platform_role = platformRole
    }

    try {
      const res = await fetch('/api/v1/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to send invite')
      }

      setStatus('success')
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send invite')
      setStatus('error')
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900">Send Invitation</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {status === 'success' ? (
          <p className="py-4 text-center text-sm text-green-600 font-medium">Invite sent!</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="invite-email" className="mb-1 block text-xs font-medium text-zinc-600">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>

            {projectId ? (
              <div>
                <label htmlFor="invite-project-role" className="mb-1 block text-xs font-medium text-zinc-600">
                  Project Role
                </label>
                <select
                  id="invite-project-role"
                  value={projectRole}
                  onChange={(e) => setProjectRole(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                >
                  <option value="owner">Owner</option>
                  <option value="tech_lead">Tech Lead</option>
                  <option value="contributor">Contributor</option>
                  <option value="observer">Observer</option>
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor="invite-platform-role" className="mb-1 block text-xs font-medium text-zinc-600">
                  Platform Role
                </label>
                <select
                  id="invite-platform-role"
                  value={platformRole}
                  onChange={(e) => setPlatformRole(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                >
                  <option value="user">User</option>
                  <option value="power_user">Power User</option>
                </select>
              </div>
            )}

            {status === 'error' && (
              <p className="text-xs text-red-500">{errorMsg}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {status === 'loading' ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
