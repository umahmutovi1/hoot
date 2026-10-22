import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { syncQueueFor } from '@/app/sync'
import { useAuth } from '@/features/auth/auth-context'
import { cardReviewsKey, invalidatePlanInputs, usePlanInputs } from '@/features/plan/api'
import { buildPlanState } from '@/features/plan/state'
import { useDayBoundary } from '@/features/settings/profile'
import type { Card, SourceWithUnits } from '@/features/sources/model'
import { localDay } from '@/lib/day'
import { supabase } from '@/lib/supabase'
import type { Op } from '@/lib/sync'
import { planReviews, type CardReview, type Outcome, type UnitReview } from './apply'
import { reviewLimits, type ReviewLimit } from './limits'

// Reviews are written through the offline queue like the timer: a test taken without a network
// is kept and sent later. Screens see the new levels and strength at once (cache patch).

function useUserId() {
  return useAuth().session?.user.id
}

/** Priority and exam limit of every unit, from the same state the plan is built from. */
export function useReviewLimits(): Map<string, ReviewLimit> | null {
  const boundary = useDayBoundary()
  const inputs = usePlanInputs(boundary)
  // The moment the screen opened: limits do not move while a test is taken.
  const [now] = useState(() => new Date())
  return useMemo(() => {
    if (!inputs) return null
    const { state } = buildPlanState(inputs, { now, boundary })
    return reviewLimits(state, localDay(now, boundary))
  }, [inputs, boundary, now])
}

/** Cards of some units (front, back and memory), for the gate and the check. */
export function useCardsOf(unitIds: string[]) {
  const userId = useUserId()
  const ids = [...new Set(unitIds)].sort()
  return useQuery({
    queryKey: ['review', userId, 'cards', ids] as const,
    enabled: Boolean(userId) && ids.length > 0,
    queryFn: async (): Promise<Card[]> => {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .in('unit_id', ids)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

/** Unit and card patches from the ops show at once on every screen that lists units. */
function patchCaches(queryClient: QueryClient, userId: string, ops: Op[]) {
  const units = new Map<string, Record<string, unknown>>()
  for (const op of ops)
    if (op.kind === 'update' && op.table === 'units')
      units.set(String(op.match.id), { ...units.get(String(op.match.id)), ...op.patch })
  if (units.size === 0) return
  const patch = (list: SourceWithUnits[] | undefined) =>
    list?.map((s) =>
      s.units.some((u) => units.has(u.id))
        ? { ...s, units: s.units.map((u) => (units.has(u.id) ? { ...u, ...units.get(u.id) } : u)) }
        : s,
    )
  queryClient.setQueriesData<SourceWithUnits[]>({ queryKey: ['sources', userId] }, patch)
  queryClient.setQueriesData<SourceWithUnits[]>({ queryKey: ['plan', userId, 'sources'] }, patch)
}

/** Writes rated units and cards; returns the outcome per item (Provjera sažetak). */
export function useReviewWriter() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const boundary = useDayBoundary()
  const limits = useReviewLimits()

  const write = useCallback(
    async (ops: Op[]) => {
      if (!userId || ops.length === 0) return
      patchCaches(queryClient, userId, ops)
      const queue = syncQueueFor(userId)
      await queue.enqueue(...ops)
      if (navigator.onLine)
        void queue
          .flush()
          .then(() =>
            Promise.all([
              queryClient.invalidateQueries({ queryKey: ['sources', userId] }),
              queryClient.invalidateQueries({ queryKey: ['review', userId] }),
              queryClient.invalidateQueries({ queryKey: cardReviewsKey(userId) }),
              invalidatePlanInputs(queryClient, userId),
            ]),
          )
    },
    [userId, queryClient],
  )

  const save = useCallback(
    async (units: UnitReview[], cards: CardReview[]): Promise<Outcome[]> => {
      const now = new Date()
      const plan = planReviews(units, cards, {
        today: localDay(now, boundary),
        at: now.toISOString(),
        boundary,
        limits: limits ?? new Map(),
      })
      await write(plan.ops)
      return plan.outcomes
    },
    [boundary, limits, write],
  )

  return { save, write, ready: limits !== null }
}
