import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import { toLocalDate, wallClock, weekdayOf } from '@/lib/day'
import { supabase } from '@/lib/supabase'
import { eventsKey } from './api'

const BATCH = 50
const AHEAD_MS = 60 * 86_400_000
/** Let a sync settle before asking (events come in bursts). */
const DELAY_MS = 3000

/**
 * Asks classify-events about the titles the rules cannot read (docs/CALENDAR-SYNC.md
 * "Klasifikacija"): upcoming events only, at most 50 per call, each one once per app start. Until
 * the answer comes, such an event counts as busy, which is the safe default for the plan.
 */
export function EventClassifier() {
  const userId = useAuth().session?.user.id
  const { locale } = useLocale()
  const queryClient = useQueryClient()
  const { eventKinds, timeZone } = useScheduleData()
  const { data: subjects } = useSubjects()
  const asked = useRef(new Set<string>())
  const stopped = useRef(false)

  const now = Date.now()
  const pending = eventKinds.unclassified.filter(
    (e) =>
      !asked.current.has(e.id) &&
      Date.parse(e.ends_at) > now &&
      Date.parse(e.starts_at) < now + AHEAD_MS,
  )
  const signature = pending
    .slice(0, BATCH)
    .map((e) => e.id)
    .join(',')

  useEffect(() => {
    if (!userId || !signature || stopped.current || !navigator.onLine) return
    const batch = pending.slice(0, BATCH)
    const timer = setTimeout(() => {
      for (const e of batch) asked.current.add(e.id)
      const body = {
        locale,
        subjects: (subjects ?? []).filter((s) => !s.archived).map((s) => s.name.slice(0, 200)),
        events: batch.map((e) => {
          const start = new Date(e.starts_at)
          const w = wallClock(start, timeZone)
          return {
            id: e.id,
            title: (e.title ?? '').slice(0, 300),
            minutes: Math.min(
              14 * 24 * 60,
              Math.max(0, Math.round((Date.parse(e.ends_at) - start.getTime()) / 60_000)),
            ),
            weekday: weekdayOf(toLocalDate(w.year, w.month, w.day)),
            start_min: w.minutes,
            weekly: eventKinds.series.has(e.id),
          }
        }),
      }
      void supabase.functions
        .invoke('classify-events', { method: 'POST', body })
        .then(({ error }) => {
          // Out of AI calls or failing: the events stay busy; try again on the next app start.
          if (error) stopped.current = true
          else void queryClient.invalidateQueries({ queryKey: eventsKey(userId) })
        })
    }, DELAY_MS)
    return () => clearTimeout(timer)
    // The signature stands for the batch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, userId])

  return null
}
