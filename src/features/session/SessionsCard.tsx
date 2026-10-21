import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRightIcon, TimerIcon } from '@/components/icons'
import { useDayBoundary } from '@/features/settings/profile'
import { localDay, startOfWeek } from '@/lib/day'
import { formatDuration } from '@/features/sources/format'
import { useSessions } from './api'
import { sessionMinutes } from './model'

/**
 * Entry to the session history: on Napredak this week's sessions, on a subject its sessions.
 */
export function SessionsCard({ subjectId }: { subjectId?: string }) {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const { data } = useSessions()
  const [now] = useState(() => new Date())
  const weekStart = startOfWeek(localDay(now, boundary))
  const list = (data ?? []).filter(
    (s) =>
      (subjectId ? s.subject_id === subjectId : true) &&
      (subjectId || localDay(new Date(s.started_at), boundary) >= weekStart),
  )
  const minutes = list.reduce((sum, s) => sum + sessionMinutes(s), 0)

  return (
    <Link
      to={subjectId ? `/sessions?subject=${subjectId}` : '/sessions'}
      className="flex items-center gap-3 rounded-card glass p-4"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <TimerIcon size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{t('session.history.title')}</span>
        <span className="text-xs text-ink-muted">
          {list.length === 0
            ? t('session.history.cardEmpty')
            : [
                subjectId
                  ? t('session.history.count', { count: list.length })
                  : t('session.history.thisWeek', { count: list.length }),
                formatDuration(t, minutes),
              ].join(' · ')}
        </span>
      </span>
      <ChevronRightIcon size={18} className="text-ink-muted" />
    </Link>
  )
}
