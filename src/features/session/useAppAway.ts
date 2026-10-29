import { useEffect, useRef } from 'react'
import { awaySeconds } from '@/lib/session/away'

const keyOf = (sessionId: string) => `hoot-away:${sessionId}`

/**
 * Notices leaving the app while the timer runs and calls `onReturn` with the seconds away. The
 * moment of leaving is kept in localStorage, so a PWA the system closed meanwhile still counts it
 * when the session screen opens again.
 */
export function useAppAway(
  sessionId: string | undefined,
  running: boolean,
  onReturn: (sec: number) => void,
) {
  const state = useRef({ running, onReturn })
  useEffect(() => {
    state.current = { running, onReturn }
  })

  useEffect(() => {
    if (!sessionId) return
    const key = keyOf(sessionId)
    const back = () => {
      let hidden: string | null = null
      try {
        hidden = localStorage.getItem(key)
        localStorage.removeItem(key)
      } catch {
        return
      }
      if (!hidden) return
      const sec = awaySeconds(new Date(hidden), new Date())
      if (sec !== null) state.current.onReturn(sec)
    }
    const onChange = () => {
      if (document.visibilityState === 'visible') return back()
      if (!state.current.running) return
      try {
        localStorage.setItem(key, new Date().toISOString())
      } catch {
        // Without storage the leave is not counted.
      }
    }
    if (document.visibilityState === 'visible') back()
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [sessionId])
}
