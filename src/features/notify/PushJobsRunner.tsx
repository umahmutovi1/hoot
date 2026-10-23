import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/auth-context'
import { usePlanBlocks } from '@/features/plan/api'
import { blockTitle, useUnitIndex } from '@/features/plan/model'
import { useDayBoundary, useProfile } from '@/features/settings/profile'
import { useSubjects } from '@/features/subjects/api'
import { useNow } from '@/features/session/useNow'
import { localDay } from '@/lib/day'
import { formatClock } from '@/lib/schedule'
import { supabase } from '@/lib/supabase'
import { useSubscriptions } from './api'
import { diffJobs, firstBlockJobs, type SavedJob } from './jobs'

/** Settles a burst of plan writes before touching the jobs. */
const DEBOUNCE_MS = 3000

/**
 * Keeps "Prvi blok dana" jobs in step with the saved plan: one per day for the next 7 days,
 * 10 min before the first block, only while some device is subscribed and the switch is on.
 * Needs the network (the jobs are for the server); it runs again when the plan changes.
 */
export function PushJobsRunner() {
  const { t } = useTranslation()
  const userId = useAuth().session?.user.id
  const boundary = useDayBoundary()
  const { data: profile } = useProfile()
  const { data: subs } = useSubscriptions()
  const { data: blocks } = usePlanBlocks(boundary)
  const { data: subjects = [] } = useSubjects()
  const units = useUnitIndex()
  const now = useNow(15 * 60_000)
  const synced = useRef<string | null>(null)

  const wanted = useMemo(() => {
    if (!profile || !subs || !blocks) return null
    if (!profile.notify_first_block || subs.length === 0) return []
    const today = localDay(now, boundary)
    return firstBlockJobs(blocks, today, now, (b) => ({
      title: t('notify.push.firstBlockTitle', {
        subject: subjects.find((s) => s.id === b.subject_id)?.name ?? 'Hoot',
      }),
      body: t('notify.push.firstBlockBody', {
        title: blockTitle(t, b, units),
        time: b.start_min === null ? '' : formatClock(b.start_min % 1440),
      }),
    }))
  }, [profile, subs, blocks, subjects, units, now, boundary, t])

  const key = wanted === null ? null : JSON.stringify(wanted)
  useEffect(() => {
    if (!userId || key === null || wanted === null || synced.current === key) return
    const timer = setTimeout(() => {
      if (!navigator.onLine) return
      void (async () => {
        const { data, error } = await supabase
          .from('push_jobs')
          .select('id, kind, ref, send_at, title, body, sent_at')
          .eq('kind', 'first_block')
          .gte('send_at', new Date(Date.now() - 24 * 60 * 60_000).toISOString())
        if (error) return
        const { upsert, remove } = diffJobs(data as SavedJob[], wanted)
        if (remove.length > 0) await supabase.from('push_jobs').delete().in('id', remove)
        if (upsert.length > 0)
          await supabase.from('push_jobs').upsert(
            upsert.map((j) => ({ ...j, sent_at: null })),
            { onConflict: 'user_id,kind,ref' },
          )
        synced.current = key
      })()
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [userId, key, wanted])

  return null
}
