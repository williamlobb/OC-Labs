'use client'

import { useState, useRef, useEffect } from 'react'
import { Claude } from '@lobehub/icons'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ChatMessage } from '@/types'
import { ProjectChat } from './ProjectChat'

interface ProjectChatPanelProps {
  projectId: string
}

export function ProjectChatPanel({ projectId }: ProjectChatPanelProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
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
      className={cn(
        'relative overflow-visible rounded-2xl border border-white/30 bg-white/70 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out dark:border-zinc-700/40 dark:bg-zinc-900/70',
        isExpanded ? 'h-[48rem]' : 'h-96'
      )}
    >
      <div className="relative flex h-full min-h-0 flex-col overflow-visible pt-10">
        <div className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center">
          <button
            type="button"
            onClick={() => setIsExpanded((previous) => !previous)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200/80 bg-white/80 text-zinc-500 shadow-sm backdrop-blur transition-colors hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:text-zinc-200"
            aria-label={isExpanded ? 'Shrink chat panel' : 'Expand chat panel'}
            title={isExpanded ? 'Shrink chat panel' : 'Expand chat panel'}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
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
