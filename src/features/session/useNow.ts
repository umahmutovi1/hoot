import { useEffect, useState } from 'react'

/**
 * Re-renders every `ms` so the clock on screen moves. Only the display ticks: the time shown is
 * always computed from segment timestamps, never added up from these ticks.
 */
export function useNow(ms = 1000, enabled = true): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!enabled) return
    const update = () => setNow(new Date())
    update()
    const id = setInterval(update, ms)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', update)
    }
  }, [ms, enabled])
  return now
}
