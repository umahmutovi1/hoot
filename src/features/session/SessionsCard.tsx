import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRightIcon, TimerIcon } from '@/components/icons'
import { useDayBoundary } from '@/features/settings/profile'
import { usePlanBlocks } from '@/features/plan/api'
import { addDays, localDay, startOfWeek } from '@/lib/day'
import { formatDuration } from '@/features/sources/format'
import { useSessions } from './api'
import { sessionMinutes } from './model'

/**
 * Entry to the session history: on Napredak this week's sessions, on a subject its sessions.
 */
export function SessionsCard({ subjectId }: { subjectId?: string }) {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const { data, isPending } = useSessions()
  const [now] = useState(() => new Date())
  const weekStart = startOfWeek(localDay(now, boundary))
  const list = (data ?? []).filter(
    (s) =>
      (subjectId ? s.subject_id === subjectId : true) &&
      (subjectId || localDay(new Date(s.started_at), boundary) >= weekStart),
  )
  const minutes = list.reduce((sum, s) => sum + sessionMinutes(s), 0)
  // Napredak: this week's done time against its plan (board NapredakA).
  const { data: blocks = [] } = usePlanBlocks(boundary)
  const planned = subjectId
    ? 0
    : blocks
        .filter((b) => b.on_date >= weekStart && b.on_date <= addDays(weekStart, 6))
        .reduce((sum, b) => sum + b.planned_minutes, 0)

  return (
    <Link
      to={subjectId ? `/sessions?subject=${subjectId}` : '/sessions'}
      className="flex items-center gap-3 rounded-card surface p-4"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand-strong">
        <TimerIcon size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{t('session.history.title')}</span>
        <span className="text-xs text-ink-muted">
          {isPending
            ? '\u00a0'
            : list.length === 0
              ? t('session.history.cardEmpty')
              : subjectId
                ? [
                    t('session.history.count', { count: list.length }),
                    formatDuration(t, minutes),
                  ].join(' · ')
                : [
                    planned > 0
                      ? t('session.week.thisWeekOf', {
                          done: formatDuration(t, minutes),
                          planned: formatDuration(t, planned),
                        })
                      : formatDuration(t, minutes),
                    t('session.week.count', { count: list.length }),
                  ].join(' · ')}
        </span>
      </span>
      <ChevronRightIcon size={18} className="text-ink-muted" />
    </Link>
  )
}
