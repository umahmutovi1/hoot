import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { formatDuration } from '@/features/sources/format'
import { MINUTE } from '@/lib/session/timer'
import type { ActiveSession } from './model'
import { useSessionWriter } from './api'

/** Below this the session was most likely started by accident. */
export const ACCIDENTAL_MS = 2 * MINUTE

/**
 * "Završi" before the planned time (or after a moment): the disclaimer and the three ways out,
 * so ending early is never one stray tap (decision after 8b).
 */
export function EndEarlySheet({
  data,
  activeMs,
  open,
  onOpenChange,
  onFinish,
}: {
  data: ActiveSession
  activeMs: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onFinish: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const writer = useSessionWriter()
  const planned = data.session.planned_minutes
  const studied = Math.floor(activeMs / MINUTE)
  const accidental = activeMs < ACCIDENTAL_MS
  const body = accidental
    ? t('session.endEarly.accidental', { time: formatDuration(t, studied) })
    : t('session.endEarly.body', {
        left: formatDuration(t, Math.max(1, (planned ?? 0) - studied)),
        planned: formatDuration(t, planned ?? 0),
      })
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={accidental ? t('session.endEarly.accidentalTitle') : t('session.endEarly.title')}
    >
      <p className="-mt-1 text-[15px] leading-[1.45] text-ink-secondary">{body}</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="btn-primary h-12 rounded-full text-[15px] font-semibold"
        >
          {t('session.endEarly.keepGoing')}
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false)
            onFinish()
          }}
          className="h-12 rounded-full glass text-[15px] font-semibold"
        >
          {t('session.endEarly.finish')}
        </button>
        <button
          type="button"
          onClick={async () => {
            await writer.discard(data)
            onOpenChange(false)
            navigate('/', { replace: true })
          }}
          className="h-12 rounded-full text-[15px] font-semibold text-warning"
        >
          {t('session.endEarly.discard')}
        </button>
      </div>
    </BottomSheet>
  )
}
