import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { formatDuration } from '@/features/sources/format'
import type { ActiveSession } from './model'
import { useSessionWriter } from './api'

const choice =
  'flex flex-col gap-0.5 rounded-[20px] glass px-4 py-3.5 text-left disabled:opacity-60'

/**
 * Right under "Sesija završena" (decision after 8b): undo an end that came too early or by
 * accident. "Nastavi ovu sesiju" opens it again; "Počni iznova" starts the same session from zero
 * and asks whether the minutes just studied stay as their own session; "Odbaci" deletes it.
 */
export function EndActions({ data, studiedMin }: { data: ActiveSession; studiedMin: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const writer = useSessionWriter()
  const [sheet, setSheet] = useState<'restart' | 'discard' | null>(null)
  const [busy, setBusy] = useState(false)
  const { session, segments } = data
  const minutes = formatDuration(t, studiedMin)

  const run = async (action: () => Promise<unknown>, to: string) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
      navigate(to, { replace: true })
    } finally {
      setBusy(false)
    }
  }
  const startAgain = () =>
    writer.start({
      subjectId: session.subject_id,
      unitId: segments[0]?.unit_id ?? null,
      mode: session.mode,
      timerMode: session.timer_mode,
      blockId: session.block_id,
      plannedMinutes: session.planned_minutes,
    })

  return (
    <section className="flex flex-col gap-2.5 rounded-card glass p-4">
      <span className="text-sm text-ink-secondary">{t('session.endActions.hint')}</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => writer.reopen(data), '/session')}
          className="btn-primary h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-60"
        >
          {t('session.endActions.resume')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setSheet('restart')}
          className="h-11 rounded-full bg-canvas px-4 text-sm font-semibold text-brand disabled:opacity-60"
        >
          {t('session.endActions.restart')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setSheet('discard')}
          className="h-11 rounded-full px-3 text-sm font-semibold text-warning disabled:opacity-60"
        >
          {t('session.endActions.discard')}
        </button>
      </div>

      <BottomSheet
        open={sheet === 'restart'}
        onOpenChange={(o) => !o && setSheet(null)}
        title={t('session.endActions.restartTitle')}
        subtitle={t('session.endActions.restartSub', { minutes })}
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(startAgain, '/session')}
            className={choice}
          >
            <span className="text-[15px] font-semibold">
              {t('session.endActions.keep', { minutes })}
            </span>
            <span className="text-[13px] text-ink-muted">{t('session.endActions.keepSub')}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await writer.discard(data)
                await startAgain()
              }, '/session')
            }
            className={choice}
          >
            <span className="text-[15px] font-semibold text-warning">
              {t('session.endActions.delete', { minutes })}
            </span>
            <span className="text-[13px] text-ink-muted">{t('session.endActions.deleteSub')}</span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'discard'}
        onOpenChange={(o) => !o && setSheet(null)}
        title={t('session.endActions.discardTitle')}
        subtitle={t('session.endActions.discardSub', { minutes })}
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSheet(null)}
            className="h-12 flex-1 rounded-full glass text-[15px] font-semibold"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => writer.discard(data), '/')}
            className="h-12 flex-1 rounded-full bg-warning text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {t('session.endActions.discard')}
          </button>
        </div>
      </BottomSheet>
    </section>
  )
}
