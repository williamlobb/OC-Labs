'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface NavItem {
  label: string
  href: string
  powerUserOnly: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Idea Submissions', href: '/settings/submissions', powerUserOnly: true },
  { label: 'Integrations', href: '/settings/integrations', powerUserOnly: true },
  { label: 'Roles', href: '/settings/roles', powerUserOnly: true },
  { label: 'Project Assignments', href: '/settings/project-assignments', powerUserOnly: true },
  { label: 'API Keys', href: '/settings/api-keys', powerUserOnly: true },
]

interface Props {
  isPowerUser: boolean
}

export function SettingsNav({ isPowerUser }: Props) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => !item.powerUserOnly || isPowerUser)

  return (
    <nav className="w-52 shrink-0 space-y-1 pt-1">
      <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Settings
      </p>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'block rounded-lg px-3 py-2 text-sm transition-colors',
            pathname === item.href
              ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
