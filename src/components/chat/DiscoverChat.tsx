'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils/cn'
import { useSpinnerVerb } from '@/lib/chat/use-spinner-verb'

function WaitingIndicator({ active }: { active: boolean }) {
  const verb = useSpinnerVerb(active)
  return (
    <span
      aria-live="polite"
      className="inline-flex min-h-[1.25rem] items-baseline gap-0.5 leading-5"
    >
      <span className="bg-[linear-gradient(110deg,#a1a1aa_35%,#e4e4e7_50%,#a1a1aa_65%)] bg-[length:220%_100%] bg-clip-text text-transparent motion-safe:animate-[chat-verb-shimmer_1.6s_linear_infinite] dark:bg-[linear-gradient(110deg,#71717a_35%,#e4e4e7_50%,#71717a_65%)]">
        {verb}
      </span>
      <span className="text-zinc-400">...</span>
    </span>
  )
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface DiscoverChatProps {
  initialMessages: Message[]
  onMessagesChange?: (messages: Message[]) => void
  isPower?: boolean
}

export function DiscoverChat({ initialMessages, onMessagesChange, isPower = false }: DiscoverChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  function updateMessages(updater: (prev: Message[]) => Message[]) {
    setMessages((prev) => {
      const next = updater(prev)
      onMessagesChange?.(next)
      return next
    })
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }
    updateMessages((prev) => [...prev, userMsg])
    setStreaming(true)

    const assistantId = crypto.randomUUID()
    updateMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ])

    try {
      const res = await fetch('/api/v1/discover/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) {
        updateMessages((prev) =>
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
        updateMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: snap } : m))
        )
      }

      // If the response contains a project link, prefetch so navigation is instant
      const match = accumulated.match(/\/projects\/([\w-]+)/)
      if (match) {
        router.prefetch(`/projects/${match[1]}`)
      }
    } catch {
      updateMessages((prev) =>
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
      <div className="flex-1 overflow-y-auto space-y-4 pt-4 pb-4">
        {messages.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-400">
            {isPower ? (
              <>
                <p className="font-medium text-zinc-500">Start a new project</p>
                <p className="mt-1">Tell me what you&apos;re building and I&apos;ll help you set it up.</p>
              </>
            ) : (
              <>
                <p className="font-medium text-zinc-500">Got an idea?</p>
                <p className="mt-1">Share it and I&apos;ll help you put it forward for review.</p>
              </>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-xl px-4 py-2.5 text-sm',
                msg.role === 'user'
                  ? 'bg-[#007AFF] text-white'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              )}
            >
              {msg.role === 'assistant' && msg.content ? (
                <div
                  className={cn(
                    '[&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold',
                    '[&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold',
                    '[&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium',
                    '[&_p]:mb-2 [&_p]:last:mb-0',
                    '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4',
                    '[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4',
                    '[&_li]:mb-0.5',
                    '[&_code]:rounded [&_code]:bg-zinc-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs dark:[&_code]:bg-zinc-700',
                    '[&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-200 [&_pre]:p-3 dark:[&_pre]:bg-zinc-700',
                    '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
                    '[&_strong]:font-semibold',
                    '[&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800 dark:[&_a]:text-blue-400',
                    '[&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-500 dark:[&_blockquote]:border-zinc-600'
                  )}
                >
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          onClick={(e) => {
                            if (href?.startsWith('/')) {
                              e.preventDefault()
                              router.push(href)
                            }
                          }}
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content || <WaitingIndicator active={streaming} />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="py-4">
        <div className="relative flex items-end rounded-lg border border-zinc-200 bg-zinc-50 focus-within:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isPower ? 'Tell me about your new project…' : 'Describe your idea…'}
            rows={3}
            disabled={streaming}
            className="flex-1 resize-none bg-transparent px-3 py-2.5 pr-12 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none disabled:opacity-60 dark:text-zinc-100"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className={cn(
              'absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg transition-all',
              streaming || !input.trim()
                ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-500'
                : 'bg-zinc-900 text-white cursor-pointer hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300'
            )}
            aria-label="Send"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
