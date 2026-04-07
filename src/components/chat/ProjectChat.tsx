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
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this project…"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className={cn(
              'rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200',
              (streaming || !input.trim()) && 'opacity-40 cursor-not-allowed'
            )}
          >
            Send
          </button>
        </div>
        <p className="mt-1.5 text-xs text-zinc-400">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
