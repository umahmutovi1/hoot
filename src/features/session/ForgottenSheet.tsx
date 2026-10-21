import { useState } from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { formatDuration } from '@/features/sources/format'
import { MINUTE, suggestedEnd, type Segment } from '@/lib/session/timer'
import { endAt } from './model'
import { useSessionUi } from './store'

/**
 * Forgotten timer (> 3 h on one segment): "Jesi li učila do sad?" — keep going, or end the
 * session at the time the user really stopped (PRD decision, Stage 7).
 */
export function ForgottenSheet({
  segment,
  now,
  onFinish,
}: {
  segment: Segment
  now: Date
  onFinish: (at: Date) => void
}) {
  const { t } = useTranslation()
  const keep = useSessionUi((s) => s.keepSegment)
  const [time, setTime] = useState(() => format(suggestedEnd(segment, now), 'HH:mm'))
  const end = endAt(segment.startedAt, time, now)

  return (
    <BottomSheet
      open
      onOpenChange={(o) => !o && keep(segment.id)}
      title={t('session.forgotten.title')}
      subtitle={t('session.forgotten.body', {
        time: format(segment.startedAt, 'HH:mm'),
        duration: formatDuration(t, (now.getTime() - segment.startedAt.getTime()) / MINUTE),
      })}
    >
      <button
        type="button"
        onClick={() => keep(segment.id)}
        className="h-14 rounded-full bg-brand text-base font-semibold text-white"
      >
        {t('session.forgotten.yes')}
      </button>
      <div className="flex flex-col gap-2 rounded-[24px] bg-canvas p-4">
        <label className="flex items-center justify-between gap-3 text-[15px] font-semibold">
          {t('session.forgotten.stoppedAt')}
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-11 rounded-[14px] bg-surface px-3 text-[15px]"
          />
        </label>
        <button
          type="button"
          disabled={!end}
          onClick={() => end && onFinish(end)}
          className="h-12 rounded-full bg-surface text-[15px] font-semibold text-brand disabled:opacity-50"
        >
          {t('session.forgotten.finishAt', { time })}
        </button>
      </div>
    </BottomSheet>
  )
}
