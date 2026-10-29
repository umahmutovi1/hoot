import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { planBlocksKey } from '@/features/plan/api'
import { supabase } from '@/lib/supabase'
import { eventsKey, useCalendarFeeds, useSyncCalendars } from './api'

const KEY = 'hoot-calendar-sync-at'
const INTERVAL_MS = 30 * 60_000
/** Server writes come in bursts (a sync upserts many events): refetch once they settle. */
const REALTIME_DEBOUNCE_MS = 800

/**
 * Syncs connected calendars when the app opens or comes back to the foreground, at most once in
 * 30 minutes (PRD: the trigger on opening; pg_cron covers the rest every 3 h). Every feed counts,
 * deadline feeds (Moodle) too. The function skips feeds synced recently anyway.
 *
 * Also listens to server-side writes (cron sync, later Google webhooks) through Realtime, so an
 * open app refetches the events and blocks and ReplanRunner replans without a reload.
 */
export function CalendarSync() {
  const userId = useAuth().session?.user.id
  const { data: feeds } = useCalendarFeeds()
  const sync = useSyncCalendars()
  const queryClient = useQueryClient()
  const hasFeed = (feeds ?? []).length > 0

  useEffect(() => {
    if (!userId || !hasFeed) return
    const run = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
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
    }
    run()
    document.addEventListener('visibilitychange', run)
    return () => document.removeEventListener('visibilitychange', run)
    // Once per app start (and per user) plus on returning to the app: not on every feeds refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hasFeed])

  useEffect(() => {
    if (!userId) return
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    const refetch = (key: readonly unknown[]) => {
      const id = JSON.stringify(key)
      clearTimeout(timers.get(id))
      timers.set(
        id,
        setTimeout(
          () => void queryClient.invalidateQueries({ queryKey: key }),
          REALTIME_DEBOUNCE_MS,
        ),
      )
    }
    const filter = `user_id=eq.${userId}`
    const channel = supabase
      .channel(`calendar-sync:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'external_events', filter },
        () => refetch(eventsKey(userId)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_blocks', filter }, () =>
        refetch(planBlocksKey(userId)),
      )
      .subscribe()
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  return null
}
