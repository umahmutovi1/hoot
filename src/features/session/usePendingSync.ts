import { useEffect, useState } from 'react'
import { syncQueueFor } from '@/app/sync'
import { useAuth } from '@/features/auth/auth-context'

/** Number of writes still waiting in the offline queue. */
export function usePendingSync(): number {
  const userId = useAuth().session?.user.id
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!userId) return
    const queue = syncQueueFor(userId)
    const update = () => void queue.pendingCount().then(setCount)
    update()
    return queue.subscribe(update)
  }, [userId])
  return count
}
