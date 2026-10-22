import { useNavigate } from 'react-router-dom'
import { useSessionWriter } from '@/features/session/api'
import { usePresets } from '@/features/session/presets'
import { useSessionUi } from '@/features/session/store'

/**
 * Starts a knowledge check without a block (due checks from "Znanje slabi", Predmet or "Imam
 * samo"): a timed session in review mode whose screen is Provjera znanja over these units.
 */
export function useStartCheck() {
  const navigate = useNavigate()
  const writer = useSessionWriter()
  const { suggestedId } = usePresets()
  const setTimerMode = useSessionUi((s) => s.setTimerMode)
  const setCheck = useSessionUi((s) => s.setCheck)
  return async (
    subjectId: string,
    unitIds: string[],
    minutes: number,
    timerMode: string = suggestedId,
  ) => {
    const sessionId = await writer.start({
      subjectId,
      unitId: unitIds[0] ?? null,
      mode: 'review',
      timerMode,
      plannedMinutes: Math.max(5, Math.round(minutes)),
    })
    setTimerMode(timerMode)
    if (!sessionId) return
    setCheck({ sessionId, unitIds })
    navigate('/session/review')
  }
}
