import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { useToast } from '@/components/toast-store'
import { formatDuration } from '@/features/sources/format'
import { MINUTE } from '@/lib/session/timer'
import type { ActiveSession } from './model'
import { useSessionWriter } from './api'

/** Below this the session was most likely started by accident. */
export const ACCIDENTAL_MS = 2 * MINUTE

/**
 * "Završi" always asks (decision, Stage 10b): finishing or discarding a session happens only
 * here, never on one stray tap; back just leaves with the timer running. Before the planned time
 * the text says how much is left; right after the start it suggests discarding. Discard has undo.
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
  const show = useToast((s) => s.show)
  const planned = data.session.planned_minutes
  const studied = Math.floor(activeMs / MINUTE)
  const accidental = activeMs < ACCIDENTAL_MS
  const early = planned !== null && studied < planned - 1
  const title = accidental
    ? t('session.endEarly.accidentalTitle')
    : early
      ? t('session.endEarly.title')
      : t('session.leave.title')
  const body = accidental
    ? t('session.endEarly.accidental', { time: formatDuration(t, studied) })
    : early
      ? t('session.endEarly.body', {
          left: formatDuration(t, Math.max(1, planned - studied)),
          planned: formatDuration(t, planned),
        })
      : t('session.leave.body', { time: formatDuration(t, studied) })

  const discard = async () => {
    await writer.discard(data)
    onOpenChange(false)
    navigate('/', { replace: true })
    show(t('session.leave.discarded'), {
      label: t('today.cant.undo'),
      run: () => {
        void writer.restore(data).then(() => navigate('/session'))
      },
    })
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      <p className="-mt-1 text-[15px] leading-[1.45] text-ink-secondary">{body}</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            onOpenChange(false)
            onFinish()
          }}
          className="btn-primary h-12 rounded-full text-[15px] font-semibold"
        >
          {early ? t('session.endEarly.finish') : t('session.leave.finishNow')}
        </button>
        <button
          type="button"
          onClick={() => void discard()}
          className="flex min-h-12 flex-col items-center justify-center rounded-full glass px-4 py-2"
        >
          <span className="text-[15px] font-semibold text-danger">
            {t('session.leave.discard')}
          </span>
          <span className="text-xs text-ink-muted">{t('session.leave.discardSub')}</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="h-12 rounded-full text-[15px] font-semibold text-brand"
        >
          {t('session.endEarly.keepGoing')}
        </button>
      </div>
    </BottomSheet>
  )
}
