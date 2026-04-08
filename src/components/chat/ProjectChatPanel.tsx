'use client'

import { useState } from 'react'
import { Claude } from '@lobehub/icons'
import type { ChatMessage } from '@/types'
import { ProjectChat } from './ProjectChat'

interface ProjectChatPanelProps {
  projectId: string
}

export function ProjectChatPanel({ projectId }: ProjectChatPanelProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="mx-auto rounded-full transition-transform duration-200 ease-out hover:scale-110 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
        aria-label="Open project chat"
        title="Open project chat"
      >
        <span className="inline-flex drop-shadow-[0_14px_28px_rgba(15,23,42,0.45)]">
          <Claude.Avatar size={72} />
        </span>
      </button>
    )
  }

  return (
    <div className="relative h-96 overflow-visible rounded-2xl border border-white/30 bg-white/70 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out dark:border-zinc-700/40 dark:bg-zinc-900/70">
      <div className="relative flex h-full min-h-0 flex-col overflow-visible pt-3">
        <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="group p-1 transition-transform duration-200 hover:-translate-y-0.5"
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
          <button
            type="button"
            onClick={() => setMessages([])}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            title="Clear chat history"
          >
            New session
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl pb-1 pt-2">
          <ProjectChat
            projectId={projectId}
            initialMessages={messages}
            onMessagesChange={setMessages}
          />
        </div>
      </div>
    </div>
  )
}
