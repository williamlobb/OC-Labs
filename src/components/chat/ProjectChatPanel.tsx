'use client'

import { useState, useRef, useEffect } from 'react'
import { Claude } from '@lobehub/icons'
import type { ChatMessage } from '@/types'
import { ProjectChat } from './ProjectChat'

interface ProjectChatPanelProps {
  projectId: string
}

export function ProjectChatPanel({ projectId }: ProjectChatPanelProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (collapsed) return

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setCollapsed(true)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [collapsed])

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-full transition-transform duration-200 ease-out hover:scale-110 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          aria-label="Open project chat"
          title="Open project chat"
        >
          <span className="inline-flex drop-shadow-[0_14px_28px_rgba(15,23,42,0.45)]">
            <Claude.Avatar size={72} />
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className="relative h-96 overflow-visible rounded-2xl border border-white/30 bg-white/70 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out dark:border-zinc-700/40 dark:bg-zinc-900/70"
    >
      <div className="relative flex h-full min-h-0 flex-col overflow-visible pt-3">
        <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 items-center">
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
