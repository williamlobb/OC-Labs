'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Project, ProjectStatus } from '@/types'

const ALL_STATUSES: ProjectStatus[] = ['Idea', 'In progress', 'Needs help', 'Paused', 'Shipped']

interface ProjectFormProps {
  initial?: Partial<Project>
  mode: 'create' | 'edit'
  projectId?: string
}

interface FormErrors {
  title?: string
  notion_url?: string
  github_repos?: string
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function ProjectForm({ initial, mode, projectId }: ProjectFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? 'Idea')
  const [notionUrl, setNotionUrl] = useState(initial?.notion_url ?? '')
  const [skillInput, setSkillInput] = useState('')
  const [skills, setSkills] = useState<string[]>(initial?.skills_needed ?? [])
  const [repoInput, setRepoInput] = useState('')
  const [repos, setRepos] = useState<string[]>(initial?.github_repos ?? [])
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function validate(): boolean {
    const next: FormErrors = {}
    if (!title.trim()) next.title = 'Title is required.'
    if (notionUrl && !isValidUrl(notionUrl)) next.notion_url = 'Must be a valid URL.'
    if (repoInput && !isValidUrl(repoInput)) next.github_repos = 'Must be a valid URL.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function addSkill() {
    const trimmed = skillInput.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed])
    }
    setSkillInput('')
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  function addRepo() {
    const trimmed = repoInput.trim()
    if (trimmed && isValidUrl(trimmed) && !repos.includes(trimmed)) {
      setRepos((prev) => [...prev, trimmed])
      setRepoInput('')
      setErrors((e) => ({ ...e, github_repos: undefined }))
    } else if (trimmed && !isValidUrl(trimmed)) {
      setErrors((e) => ({ ...e, github_repos: 'Must be a valid URL.' }))
    }
  }

  function removeRepo(url: string) {
    setRepos((prev) => prev.filter((r) => r !== url))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setServerError(null)

    const payload = {
      title: title.trim(),
      summary: summary.trim() || undefined,
      status,
      notion_url: notionUrl.trim() || undefined,
      skills_needed: skills,
      github_repos: repos,
    }

    try {
      const url =
        mode === 'create'
          ? '/api/v1/projects'
          : `/api/v1/projects/${projectId}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setServerError(body.error ?? 'Something went wrong.')
        return
      }

      const data = await res.json()
      router.push(`/projects/${data.id}`)
    } catch {
      setServerError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {serverError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {serverError}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      {/* Summary */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Summary
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Skills needed */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Skills needed
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
            placeholder="e.g. React"
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={addSkill}
            className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Add
          </button>
        </div>
        {skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="text-zinc-400 hover:text-zinc-700"
                  aria-label={`Remove ${skill}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* GitHub repos */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          GitHub repositories
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRepo() } }}
            placeholder="https://github.com/org/repo"
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={addRepo}
            className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Add
          </button>
        </div>
        {errors.github_repos && <p className="mt-1 text-xs text-red-600">{errors.github_repos}</p>}
        {repos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {repos.map((url) => (
              <li key={url} className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span className="truncate">{url}</span>
                <button
                  type="button"
                  onClick={() => removeRepo(url)}
                  className="ml-2 text-zinc-400 hover:text-red-600"
                  aria-label={`Remove ${url}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Notion URL */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Notion URL
        </label>
        <input
          type="url"
          value={notionUrl}
          onChange={(e) => setNotionUrl(e.target.value)}
          placeholder="https://notion.so/..."
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {errors.notion_url && <p className="mt-1 text-xs text-red-600">{errors.notion_url}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {submitting ? 'Saving…' : mode === 'create' ? 'Create project' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
