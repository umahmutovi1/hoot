import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TimerIcon } from '@/components/icons'
import { Dock } from '@/features/owl/OwlBar'
import { useSubject } from '@/features/subjects/api'
import { activeMs, openSegment } from '@/lib/session/timer'
import type { ActiveSession } from './model'
import { formatClock, toSegment } from './model'
import { useNow } from './useNow'

/** While a session runs it takes the owl bar's place on Today (the session comes first). */
export function ActiveSessionBar({ data }: { data: ActiveSession }) {
  const { t } = useTranslation()
  const now = useNow()
  const { data: subject } = useSubject(data.session.subject_id)
  const list = data.segments.map(toSegment)
  const running = Boolean(openSegment(list))
  return (
    <Dock>
      <Link
        to="/session"
        className="flex h-14 items-center gap-2 rounded-full bg-brand px-1.5 text-white shadow-[0_6px_24px_rgba(47,35,99,0.24)]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15">
          <TimerIcon size={22} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold">
            {subject?.name ?? t('session.title')}
          </span>
          <span className="text-xs text-white/75">
            {running ? t('session.timer.running') : t('session.timer.paused')}
          </span>
        </span>
        <span className="pr-4 text-lg font-semibold tabular-nums">
          {formatClock(activeMs(list, now))}
        </span>
      </Link>
    </Dock>
  )
}
