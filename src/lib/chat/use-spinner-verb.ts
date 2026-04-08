import { useState, useEffect, useRef } from 'react'
import { SPINNER_VERBS } from './spinner-verbs'

const INTERVAL_MS = 7000

export function useSpinnerVerb(active: boolean): string {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * SPINNER_VERBS.length))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active) {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % SPINNER_VERBS.length)
    }, INTERVAL_MS)

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [active])

  return SPINNER_VERBS[index]
}
