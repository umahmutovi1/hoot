import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { CheckIcon, SignOutIcon, TrashIcon } from '@/components/icons'
import { useToast } from '@/components/toast-store'
import { formatDuration } from '@/features/sources/format'
import { MINUTE } from '@/lib/session/timer'
import { cn } from '@/lib/utils'
import type { ActiveSession } from './model'
import { useSessionWriter } from './api'

/** Below this the session was most likely started by accident. */
export const ACCIDENTAL_MS = 2 * MINUTE

/**
 * Leaving a running session is never one stray tap.
 * - `finish`: "Završi" before the planned time (or after a moment), decision after 8b.
 * - `back`: ‹, browser back or the Android gesture (decision, Stage 10b): keep studying, leave
 *   with the timer running, finish early, or discard (with undo).
 */
export function EndEarlySheet({
  data,
  activeMs,
  open,
  onOpenChange,
  onFinish,
  variant = 'finish',
  onExit,
  onBeforeLeave,
}: {
  data: ActiveSession
  activeMs: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onFinish: () => void
  variant?: 'finish' | 'back'
  /** "Izađi, timer radi dalje" (back only). */
  onExit?: () => void
  /** Called before the sheet navigates away itself (discard), so a route blocker lets it pass. */
  onBeforeLeave?: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const writer = useSessionWriter()
  const show = useToast((s) => s.show)
  const planned = data.session.planned_minutes
  const studied = Math.floor(activeMs / MINUTE)
  const accidental = activeMs < ACCIDENTAL_MS
  const back = variant === 'back'
  const body = accidental
    ? t('session.endEarly.accidental', { time: formatDuration(t, studied) })
    : back
      ? planned
        ? t('session.leave.bodyPlanned', {
            time: formatDuration(t, studied),
            planned: formatDuration(t, planned),
          })
        : t('session.leave.body', { time: formatDuration(t, studied) })
      : t('session.endEarly.body', {
          left: formatDuration(t, Math.max(1, (planned ?? 0) - studied)),
          planned: formatDuration(t, planned ?? 0),
        })
  const title = accidental
    ? t('session.endEarly.accidentalTitle')
    : back
      ? t('session.leave.title')
      : t('session.endEarly.title')

  const finish = () => {
    onOpenChange(false)
    onFinish()
  }
  const discard = async () => {
    onBeforeLeave?.()
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
          onClick={() => onOpenChange(false)}
          className="btn-primary h-12 rounded-full text-[15px] font-semibold"
        >
          {t('session.endEarly.keepGoing')}
        </button>
        {back ? (
          <>
            <Option
              icon={<SignOutIcon size={18} />}
              title={t('session.leave.exit')}
              sub={t('session.leave.exitSub')}
              onClick={() => onExit?.()}
            />
            <Option
              icon={<CheckIcon size={18} />}
              title={t('session.leave.finish')}
              sub={t('session.leave.finishSub', { time: formatDuration(t, studied) })}
              onClick={finish}
            />
            <Option
              danger
              icon={<TrashIcon size={18} />}
              title={t('session.leave.discard')}
              sub={t('session.leave.discardSub')}
              onClick={() => void discard()}
            />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={finish}
              className="h-12 rounded-full glass text-[15px] font-semibold"
            >
              {t('session.endEarly.finish')}
            </button>
            <button
              type="button"
              onClick={() => void discard()}
              className="h-12 rounded-full text-[15px] font-semibold text-warning"
            >
              {t('session.endEarly.discard')}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

function Option({
  icon,
  title,
  sub,
  danger,
  onClick,
}: {
  icon: ReactNode
  title: string
  sub: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center gap-3 rounded-[20px] bg-white/55 px-3.5 py-3 text-left shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.7),inset_0_1px_1px_rgba(255,255,255,0.9)]"
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-xl',
          danger ? 'bg-danger/10 text-danger' : 'bg-brand-soft text-brand',
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn('text-[15px] font-semibold', danger && 'text-danger')}>{title}</span>
        <span className="text-xs leading-[1.35] text-ink-muted">{sub}</span>
      </span>
    </button>
  )
}
