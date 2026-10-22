import { useEffect } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { useCalendarFeeds, useSyncCalendars } from './api'

const KEY = 'hoot-calendar-sync-at'
const INTERVAL_MS = 30 * 60_000

/**
 * Syncs connected calendars when the app opens, at most once in 30 minutes (PRD: the trigger on
 * opening; pg_cron covers the rest every 3 h). The function skips feeds synced recently anyway.
 */
export function CalendarSync() {
  const userId = useAuth().session?.user.id
  const { data: feeds } = useCalendarFeeds()
  const sync = useSyncCalendars()
  const hasBusyFeed = (feeds ?? []).some((f) => f.kind === 'busy')

  useEffect(() => {
    if (!userId || !hasBusyFeed || !navigator.onLine) return
    let last = 0
    try {
      last = Number(localStorage.getItem(KEY) ?? 0)
    } catch {
      // storage may be unavailable; the function's own 30 min check still applies
    }
    if (Date.now() - last < INTERVAL_MS) return
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      // ignore
    }
    sync.mutate({})
    // Once per app start (and per user): not on every feeds refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hasBusyFeed])
  return null
}
