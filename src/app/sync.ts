import { supabase } from '@/lib/supabase'
import { SyncDb, SyncError, SyncQueue, type Op, type Transport } from '@/lib/sync'

/** Statuses worth retrying: no network (0), expired token, timeouts, rate limits, server errors. */
const RETRY_STATUS = new Set([0, 401, 408, 425, 429])

type Table = Parameters<typeof supabase.from>[0]

/** Sends queued ops to Supabase. RLS and `user_id default auth.uid()` fill in the owner. */
export const supabaseTransport: Transport = {
  async send(op: Op) {
    const table = supabase.from(op.table as Table)
    const res =
      op.kind === 'upsert'
        ? await table.upsert(op.rows as never, { onConflict: op.onConflict })
        : op.kind === 'update'
          ? await table.update(op.patch as never).match(op.match as never)
          : await table.delete().match(op.match as never)
    if (res.error)
      throw new SyncError(res.error.message, res.status >= 500 || RETRY_STATUS.has(res.status))
  },
}

let current: { userId: string; queue: SyncQueue } | null = null

/** One queue (and IndexedDB database) per signed-in user. */
export function syncQueueFor(userId: string): SyncQueue {
  if (current?.userId !== userId) {
    current = { userId, queue: new SyncQueue(new SyncDb(`hoot-${userId}`), supabaseTransport) }
  }
  return current.queue
}
