'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

type State = 'idle' | 'confirming' | 'submitted'

export function RiskAssessmentButton() {
  const [state, setState] = useState<State>('idle')

  function handleConfirm() {
    setState('submitted')
    setTimeout(() => setState('idle'), 3000)
  }

  return (
    <>
      <button
        onClick={() => setState('confirming')}
        className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Run Risk Assessment
      </button>

      {state !== 'idle' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => state !== 'submitted' && setState('idle')}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {state === 'submitted' ? (
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                  <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Submitted</p>
                <p className="text-sm text-zinc-500">
                  This project has been queued for AI Risk Navigator review.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Run Risk Assessment
                  </h2>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    This will submit project data to the AI Risk Navigator for compliance and risk
                    review. Results will be shared with the project team.
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                  Ensure this submission has been approved by a team lead or power user before proceeding.
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setState('idle')}
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
                      'bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
                    )}
                  >
                    Confirm &amp; Submit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
