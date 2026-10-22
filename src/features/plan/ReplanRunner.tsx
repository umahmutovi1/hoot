import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { syncQueueFor } from '@/app/sync'
import { useAuth } from '@/features/auth/auth-context'
import { useActiveSession } from '@/features/session/api'
import { useDayBoundary } from '@/features/settings/profile'
import { localDay, type DayBoundary, type LocalDate } from '@/lib/day'
import { inputHash, plan } from '@/lib/scheduler'
import {
  invalidatePlanInputs,
  planBlocksKey,
  planRunKey,
  usePlanInputs,
  usePlanRun,
  type PlanRun,
} from './api'
import { applyReplace, replaceArgs } from './save'
import { buildPlanState, type PlanBlockRow } from './state'
import { usePlanStore } from './store'

/** Serial changes (several edits in a row) settle before replan (PRD "debounce 2 s"). */
const DEBOUNCE_MS = 2000

/**
 * Replan triggers (PRD "Kada se šta preračunava"): any change of a plan input — a saved edit
 * anywhere, a finished session, a calendar sync, the first opening of a new day — rebuilds the
 * state; when its hash differs from the latest plan run, the plan is computed in the browser and
 * saved through the offline queue (`replace_plan`). Never while the timer runs.
 */
export function ReplanRunner() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  const boundary = useDayBoundary()
  const inputs = usePlanInputs(boundary)
  const run = usePlanRun()
  const active = useActiveSession()
  const nudge = usePlanStore((s) => s.nudge)
  const setModel = usePlanStore((s) => s.setModel)
  const saving = useRef<string | null>(null)
  const day = useLocalDay(boundary)

  // Any successful mutation can change a plan input that the plan's own queries do not watch.
  useEffect(() => {
    if (!userId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.mutation.state.status !== 'success') return
      clearTimeout(timer)
      timer = setTimeout(() => void invalidatePlanInputs(queryClient, userId), 300)
    })
  }, [queryClient, userId])

  useEffect(() => {
    if (!userId || !inputs || run.isPending || active.isPending) return
    const timer = setTimeout(
      () => {
        const built = buildPlanState(inputs, { now: new Date(), boundary })
        // The current minute only matters for today's first plan; it stays out of the hash so
        // an empty day does not save a new run every few minutes.
        const hash = inputHash({ ...built.state, nowMin: null })
        const result = plan(built.state)
        setModel({ built, hash, result })
        if (active.data) return
        if (run.data?.input_hash === hash || saving.current === hash) return
        saving.current = hash
        const runId = crypto.randomUUID()
        const args = replaceArgs(built, result, hash, runId, boundary.timeZone)
        const queue = syncQueueFor(userId)
        void queue
          .enqueue({ kind: 'rpc', table: 'plan_blocks', fn: 'replace_plan', args: { ...args } })
          .then(() => {
            queryClient.setQueryData<PlanBlockRow[]>(planBlocksKey(userId), (old) =>
              applyReplace(old ?? [], args, userId),
            )
            const saved: PlanRun = {
              id: runId,
              input_hash: hash,
              deficit: args.p_deficit,
              created_at: new Date().toISOString(),
            }
            queryClient.setQueryData<PlanRun | null>(planRunKey(userId), () => saved)
            return queue.flush()
          })
          .then(() => queue.pendingCount())
          .then((left) => {
            if (left === 0) {
              void queryClient.invalidateQueries({ queryKey: planBlocksKey(userId) })
              void queryClient.invalidateQueries({ queryKey: planRunKey(userId) })
            }
          })
          .finally(() => {
            if (saving.current === hash) saving.current = null
          })
      },
      nudge > 0 && !saving.current ? 0 : DEBOUNCE_MS,
    )
    return () => clearTimeout(timer)
  }, [
    userId,
    inputs,
    run.data,
    run.isPending,
    active.data,
    active.isPending,
    boundary,
    nudge,
    day,
    setModel,
    queryClient,
  ])

  return null
}

/** The local day, refreshed every minute and when the app comes back (open over the boundary). */
function useLocalDay(boundary: DayBoundary): LocalDate {
  const [day, setDay] = useState(() => localDay(new Date(), boundary))
  useEffect(() => {
    const tick = () => setDay(localDay(new Date(), boundary))
    tick()
    const timer = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [boundary])
  return day
}
