import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/toast-store'
import { useAuth } from '@/features/auth/auth-context'
import { syncQueueFor } from './sync'

/**
 * Empties the offline queue when the app opens, when the network comes back and when the app
 * becomes visible again; a failed op is retried when its backoff runs out. Screens that read the
 * mirror (`['session', …]` queries) are refreshed after every change. A newly parked op (rejected
 * by the server for good) shows the error toast once.
 */
export function SyncRunner() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  useEffect(() => {
    if (!userId) return
    const queue = syncQueueFor(userId)
    let failed: number | null = null
    const checkFailed = async () => {
      const n = await queue.failedCount()
      if (failed !== null && n > failed) useToast.getState().error(t('common.saveFailed'))
      failed = n
    }
    let retry: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      if (navigator.onLine) void queue.flush()
    }
    const schedule = async () => {
      clearTimeout(retry)
      const at = await queue.nextAttemptAt()
      if (at !== null && at > Date.now()) retry = setTimeout(flush, at - Date.now())
    }
    const unsubscribe = queue.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      void schedule()
      void checkFailed()
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') flush()
    }
    window.addEventListener('online', flush)
    document.addEventListener('visibilitychange', onVisible)
    void checkFailed()
    flush()
    return () => {
      clearTimeout(retry)
      unsubscribe()
      window.removeEventListener('online', flush)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, queryClient, t])

  return null
}
