'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { ChatMessage } from '@/types'
import { ProjectChat } from './ProjectChat'

interface ProjectChatPanelProps {
  projectId: string
  initialMessages: ChatMessage[]
}

export function ProjectChatPanel({
  projectId,
  initialMessages,
}: ProjectChatPanelProps) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-white/30 bg-white/70 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out dark:border-zinc-700/40 dark:bg-zinc-900/70',
        collapsed ? 'h-12' : 'h-96'
      )}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="group flex h-full w-full items-center justify-center px-4"
          aria-label="Open project chat"
          title="Click to chat to agent"
        >
          <span className="flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1.5 transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/70">
            <span className="h-1.5 w-10 rounded-full bg-zinc-400/80 transition-all duration-200 group-hover:w-14 group-hover:bg-zinc-500 dark:bg-zinc-500/70 dark:group-hover:bg-zinc-300" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs text-zinc-500 opacity-0 transition-all duration-200 group-hover:max-w-48 group-hover:opacity-100 dark:text-zinc-300">
              Click to chat to agent
            </span>
          </span>
        </button>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-end px-4 pt-3">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              aria-label="Collapse project chat"
            >
              Minimize
            </button>
          </div>
          <div className="min-h-0 flex-1 pb-1">
            <ProjectChat projectId={projectId} initialMessages={initialMessages} />
          </div>
        </div>
      )}
    </div>
  )
}
