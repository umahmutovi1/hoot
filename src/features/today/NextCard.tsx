import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useActiveSession } from '@/features/session/api'
import { formatClock, toSegment } from '@/features/session/model'
import { useSessionUi } from '@/features/session/store'
import { useNow } from '@/features/session/useNow'
import { useSubject } from '@/features/subjects/api'
import { activeMs, openSegment } from '@/lib/session/timer'
import type { ActiveSession } from '@/features/session/model'

const label = 'text-xs font-semibold tracking-[0.6px] text-white/88 uppercase'
const action =
  'flex h-12 items-center gap-2 rounded-full bg-white/94 px-6 text-base font-semibold text-brand-strong shadow-[inset_0_1px_1px_#fff,0_6px_16px_rgba(30,20,80,0.2)]'

function PlayIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
      <path d="M1 1.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 1 1.5z" />
    </svg>
  )
}

/**
 * "Sljedeće" on Today (glass-tint card). Until the scheduler (Stage 8b) it offers a free session;
 * while a session runs it shows the timer and leads back to it.
 */
export function NextCard() {
  const { data: active } = useActiveSession()
  return active ? <RunningCard data={active} /> : <FreeCard />
}

function FreeCard() {
  const { t } = useTranslation()
  const openStart = useSessionUi((s) => s.openStart)
  return (
    <section className="glass-tint flex flex-col gap-4 rounded-card-lg p-5">
      <span className={label}>{t('today.next.label')}</span>
      <div className="flex flex-col gap-1">
        <span className="text-[22px] leading-tight font-semibold tracking-[-0.5px]">
          {t('today.next.freeTitle')}
        </span>
        <span className="text-[13px] text-white/84">{t('today.next.freeSub')}</span>
      </div>
      <button type="button" onClick={openStart} className={`${action} self-end`}>
        <PlayIcon />
        {t('today.next.start')}
      </button>
    </section>
  )
}

function RunningCard({ data }: { data: ActiveSession }) {
  const { t } = useTranslation()
  const now = useNow()
  const { data: subject } = useSubject(data.session.subject_id)
  const list = data.segments.map(toSegment)
  const running = Boolean(openSegment(list))
  return (
    <section className="glass-tint flex flex-col gap-4 rounded-card-lg p-5">
      <span className={label}>{running ? t('today.next.running') : t('today.next.paused')}</span>
      <span className="text-[22px] leading-tight font-semibold tracking-[-0.5px]">
        {subject?.name ?? t('session.title')}
      </span>
      <div className="flex items-center justify-between">
        <span className="text-[40px] font-semibold tracking-[-1.2px] tabular-nums">
          {formatClock(activeMs(list, now))}
        </span>
        <Link to="/session" className={action}>
          <PlayIcon />
          {t('today.next.resume')}
        </Link>
      </div>
    </section>
  )
}
