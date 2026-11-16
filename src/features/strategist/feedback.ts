import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { syncQueueFor } from '@/app/sync'
import { useAuth } from '@/features/auth/auth-context'
import { diffDays } from '@/lib/day'
import { supabase } from '@/lib/supabase'
import type { Row } from '@/lib/sync'
import type { Json, Tables } from '@/types/database'

export type Feedback = Tables<'progress_feedback'>
export const feedbackKey = (userId: string | undefined) => ['progress-feedback', userId] as const
export function useFeedback() {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: feedbackKey(userId),
    enabled: Boolean(userId),
    networkMode: 'always',
    queryFn: async (): Promise<Feedback[]> => {
      const queue = syncQueueFor(userId!)
      const remote: Feedback[] = []
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from('progress_feedback')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id')
          .range(offset, offset + 999)
        if (error)
          return (await queue.local('progress_feedback')).map((r) => r.row as unknown as Feedback)
        remote.push(...data)
        if (data.length < 1000) break
      }
      await queue.remember('progress_feedback', remote)
      return (await queue.merge('progress_feedback', remote)) as unknown as Feedback[]
    },
  })
}
export type FeedbackDraft = {
  insightId?: string
  candidateId?: string
  status: Feedback['status']
  payload?: unknown
}
export function useRecordFeedback() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    networkMode: 'always',
    mutationFn: async (draft: FeedbackDraft) => {
      if (!userId) throw new Error('Authentication required')
      const now = new Date().toISOString()
      const row: Feedback = {
        id: crypto.randomUUID(),
        user_id: userId,
        insight_id: draft.insightId ?? null,
        candidate_id: draft.candidateId ?? null,
        status: draft.status,
        payload: JSON.parse(JSON.stringify(draft.payload ?? {})) as Exclude<Json, null>,
        created_at: now,
        updated_at: now,
      }
      const queue = syncQueueFor(userId)
      await queue.enqueue({ kind: 'upsert', table: 'progress_feedback', rows: [row as Row] })
      queryClient.setQueryData<Feedback[]>(feedbackKey(userId), (old = []) => [row, ...old])
      if (navigator.onLine) await queue.flush()
      return row
    },
  })
}
/** Most recent feedback for a stable key; dates are UTC timestamps. */
export function latestFeedback(rows: Feedback[], id: string) {
  return rows
    .filter((r) => r.insight_id === id || r.candidate_id === id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0]
}

/**
 * "Vrati odluku" / "Vrati" on Prijedlozi: the decision is taken back and the suggestion is open
 * again. Stored as a rejection (so inputs from an accepted row switch off) marked `reverted`.
 */
export function isReverted(row: Feedback) {
  const p = row.payload
  return Boolean(p && typeof p === 'object' && !Array.isArray(p) && p.reverted === true)
}

/** Days an accepted or declined suggestion stays decided before it can be offered again. */
export const DECISION_DAYS = 14

/**
 * The latest decision for a key while it still holds: "not useful" hides for good, accepted and
 * declined only for `DECISION_DAYS`, so a new episode weeks later can be acted on.
 */
export function activeDecision(rows: Feedback[], id: string, today: string) {
  const latest = latestFeedback(rows, id)
  if (!latest || isReverted(latest)) return undefined
  if (latest.status === 'not_useful') return latest
  return diffDays(latest.created_at.slice(0, 10), today) < DECISION_DAYS ? latest : undefined
}
