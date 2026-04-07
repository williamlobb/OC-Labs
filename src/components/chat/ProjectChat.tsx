'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import type { ChatMessage } from '@/types'

interface ProjectChatProps {
  projectId: string
  initialMessages: ChatMessage[]
}

export function ProjectChat({ projectId, initialMessages }: ProjectChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      project_id: projectId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        project_id: projectId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      },
    ])

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: 'Something went wrong.' } : m
          )
        )
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const snap = accumulated
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: snap } : m))
        )
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: 'Something went wrong.' } : m
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden px-4">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pt-4 pb-4">
        {messages.length === 0 && (
          <div className="py-16 text-center text-sm text-zinc-400">
            Ask anything about this project.
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-xl px-4 py-2.5 text-sm',
                msg.role === 'user'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              )}
            >
              {msg.content || (
                <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-zinc-400" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-3">
        <div className="relative flex items-end rounded-lg border border-zinc-200 bg-zinc-50 focus-within:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this project…"
            rows={3}
            disabled={streaming}
            className="flex-1 resize-none bg-transparent px-3 py-2.5 pr-10 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none disabled:opacity-60 dark:text-zinc-100"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className={cn(
              'absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900',
              (streaming || !input.trim()) ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
            )}
            aria-label="Send"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
