import { useEffect } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { embedPending } from './embeddings'

const KEY = 'hoot-embed-at'
const INTERVAL_MS = 10 * 60_000

/**
 * Computes missing vectors when the app opens (at most every 10 minutes) and when the network
 * comes back. Imports call `embedPending()` themselves right after saving.
 */
export function EmbedRunner() {
  const userId = useAuth().session?.user.id

  useEffect(() => {
    if (!userId) return
    const run = () => {
      if (!navigator.onLine) return
      let last = 0
      try {
        last = Number(localStorage.getItem(KEY) ?? 0)
      } catch {
        // storage may be unavailable; then every start runs once
      }
      if (Date.now() - last < INTERVAL_MS) return
      try {
        localStorage.setItem(KEY, String(Date.now()))
      } catch {
        // ignore
      }
      void embedPending().catch(() => undefined)
    }
    run()
    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
  }, [userId])
  return null
}
