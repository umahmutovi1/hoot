import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { useSessionWriter } from './api'
import type { ActiveSession } from './model'
import { PresetChips } from './PresetChips'
import { useSessionUi } from './store'

/** The session's preset (reminders only) and "Odbaci sesiju". */
export function TimerSheet({
  open,
  onOpenChange,
  data,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ActiveSession
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const writer = useSessionWriter()
  const setTimerMode = useSessionUi((s) => s.setTimerMode)
  const [confirm, setConfirm] = useState(false)

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setConfirm(false)
      }}
      title={t('session.timerSheet.title')}
      subtitle={t('session.timerSheet.subtitle')}
    >
      <PresetChips
        label={t('session.timerSheet.title')}
        value={data.session.timer_mode}
        onChange={(id) => {
          setTimerMode(id)
          void writer.update(data, { timer_mode: id })
        }}
      />
      {confirm ? (
        <div className="flex flex-col gap-2 rounded-[20px] bg-warning-soft p-4">
          <span className="text-sm text-warning-ink">{t('session.timerSheet.discardConfirm')}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="h-11 flex-1 rounded-full glass text-sm font-semibold"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={async () => {
                await writer.discard(data)
                onOpenChange(false)
                navigate('/', { replace: true })
              }}
              className="h-11 flex-1 rounded-full bg-warning text-sm font-semibold text-white"
            >
              {t('session.timerSheet.discard')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="h-12 rounded-full bg-canvas text-[15px] font-semibold text-warning"
        >
          {t('session.timerSheet.discard')}
        </button>
      )}
    </BottomSheet>
  )
}
