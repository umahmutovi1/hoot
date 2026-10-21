import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { syncQueueFor } from '@/app/sync'
import { useAuth } from '@/features/auth/auth-context'
import { useOnline } from '@/features/owl/api'
import { recalibrationOps } from './recalibrate'
import { useSessionUi } from './store'

/**
 * Recomputes speed calibration for subjects whose sessions changed, once the network is there and
 * the queue is empty (the server then has every session).
 */
export function Recalibrator() {
  const userId = useAuth().session?.user.id
  const online = useOnline()
  const queryClient = useQueryClient()
  const pending = useSessionUi((s) => s.recalibrate)

  useEffect(() => {
    if (!userId || !online || pending.length === 0) return
    const queue = syncQueueFor(userId)
    let running = false
    const run = async () => {
      if (running || (await queue.pendingCount()) > 0) return
      running = true
      try {
        for (const subjectId of pending) {
          const ops = await recalibrationOps(subjectId)
          await queue.enqueue(...ops)
          await queue.flush()
          useSessionUi.getState().recalibrated(subjectId)
        }
        await queryClient.invalidateQueries({ queryKey: ['sources'] })
      } catch (e) {
        console.error('recalibration failed', e)
      } finally {
        running = false
      }
    }
    void run()
    return queue.subscribe(() => void run())
  }, [userId, online, pending, queryClient])

  return null
}
