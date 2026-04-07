'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

const TABS = [
  { label: 'Overview', href: '' },
  { label: 'Context', href: '/context' },
  { label: 'Plan', href: '/plan' },
]

interface ProjectTabsProps {
  projectId: string
}

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const pathname = usePathname()
  const base = `/projects/${projectId}`

  return (
    <nav className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`
        const isActive = tab.href === ''
          ? pathname === base || pathname === `${base}/`
          : pathname.startsWith(`${base}${tab.href}`)

        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              isActive
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
