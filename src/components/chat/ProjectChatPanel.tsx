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
        'relative rounded-2xl border border-white/30 bg-white/70 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out dark:border-zinc-700/40 dark:bg-zinc-900/70',
        collapsed ? 'h-12 overflow-hidden' : 'h-96 overflow-visible'
      )}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="group flex h-full w-full items-center justify-center px-4"
          aria-label="Open project chat"
          title="Open project chat"
        >
          <span className="inline-flex h-8 min-w-14 items-center justify-center rounded-full border border-zinc-300/80 bg-white/85 px-4 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md dark:border-zinc-600/80 dark:bg-zinc-900/80">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-zinc-600 transition-colors duration-200 group-hover:text-zinc-800 dark:text-zinc-300 dark:group-hover:text-zinc-100"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </button>
      ) : (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="group absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-300/85 bg-white/95 px-3 py-1 shadow-sm transition-all duration-200 hover:-translate-y-[55%] hover:shadow-md dark:border-zinc-600/80 dark:bg-zinc-900/90"
            aria-label="Collapse project chat"
            title="Minimize"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-zinc-600 transition-colors duration-200 group-hover:animate-[chat-arrow-bounce-down_0.75s_ease-in-out_infinite] group-hover:text-zinc-800 dark:text-zinc-300 dark:group-hover:text-zinc-100"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 0 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <div className="min-h-0 flex-1 pb-1 pt-2">
            <ProjectChat projectId={projectId} initialMessages={initialMessages} />
          </div>
        </div>
      )}
    </div>
  )
}
