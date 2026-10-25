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
import type { Json } from '@/types/database'
import { useSubscriptions } from './api'
import { blockJobs, diffJobs, isQuiet, PLAN_JOB_KINDS, type SavedJob } from './jobs'

/** Settles a burst of plan writes before touching the jobs. */
const DEBOUNCE_MS = 3000

/**
 * Keeps block reminders in step with the saved plan (Stage 10c, replaces "Prvi blok dana"): for
 * the next 7 days, at each offset the user picked before every timed block, plus "Kasniš 15 min",
 * outside quiet hours and only while some device is subscribed. Old "first block" jobs are
 * removed. Needs the network (the jobs are for the server); it runs again when the plan changes.
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
    const offsets = profile.reminder_offsets_min ?? []
    if (offsets.length === 0 || subs.length === 0) return []
    const today = localDay(now, boundary)
    const subject = (id: string) => subjects.find((s) => s.id === id)?.name ?? 'Hoot'
    return blockJobs(blocks, today, now, {
      offsets,
      quiet: (at) => isQuiet(at, boundary.timeZone, profile.sleep_min, profile.wake_min),
      text: (b, offset) => {
        const title = blockTitle(t, b, units)
        const time = b.start_min === null ? '' : formatClock(b.start_min % 1440)
        if (offset === null)
          return {
            title: t('notify.push.lateTitle', { subject: subject(b.subject_id) }),
            body: t('notify.push.lateBody', { title, time }),
          }
        return {
          title:
            offset >= 60
              ? t('notify.push.reminderTitleHours', {
                  hours: offset / 60,
                  subject: subject(b.subject_id),
                })
              : t('notify.push.reminderTitle', { minutes: offset, subject: subject(b.subject_id) }),
          body: t('notify.push.reminderBody', { title, minutes: b.planned_minutes, time }),
        }
      },
      url: (b) => `/?block=${b.id}`,
      actions: (b) => ({
        start: t('notify.push.start'),
        skip: t('notify.push.skip'),
        skippedTitle: t('notify.push.skippedTitle', {
          subject: subject(b.subject_id),
          title: blockTitle(t, b, units),
        }),
        skippedBody: t('notify.push.skippedBody'),
      }),
    })
  }, [profile, subs, blocks, subjects, units, now, boundary, t])

  const key = wanted === null ? null : JSON.stringify(wanted)
  useEffect(() => {
    if (!userId || key === null || wanted === null || synced.current === key) return
    const timer = setTimeout(() => {
      if (!navigator.onLine) return
      void (async () => {
        const { data, error } = await supabase
          .from('push_jobs')
          .select('id, kind, ref, send_at, title, body, url, sent_at')
          .in('kind', PLAN_JOB_KINDS)
          .gte('send_at', new Date(Date.now() - 24 * 60 * 60_000).toISOString())
        if (error) return
        const { upsert, remove } = diffJobs(data as SavedJob[], wanted, PLAN_JOB_KINDS)
        if (remove.length > 0) await supabase.from('push_jobs').delete().in('id', remove)
        if (upsert.length > 0)
          await supabase.from('push_jobs').upsert(
            upsert.map((j) => ({
              ...j,
              actions: (j.actions ?? null) as Json,
              sent_at: null,
              action_token_hash: null,
              action_used_at: null,
            })),
            { onConflict: 'user_id,kind,ref' },
          )
        synced.current = key
      })()
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [userId, key, wanted])

  return null
}
