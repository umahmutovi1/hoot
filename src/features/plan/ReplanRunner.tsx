import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { syncQueueFor } from '@/app/sync'
import type { Op } from '@/lib/sync'
import { useToast } from '@/components/toast-store'
import { useAuth } from '@/features/auth/auth-context'
import { useActiveSession } from '@/features/session/api'
import { useDayBoundary } from '@/features/settings/profile'
import { localDay, zonedInstant, type DayBoundary, type LocalDate } from '@/lib/day'
import { formatClock } from '@/lib/schedule'
import { DURATION_PRIORS } from '@/lib/estimates/model'
import { inputHash, plan, SCHEDULER_VERSION } from '@/lib/scheduler'
import {
  invalidatePlanInputs,
  planBlocksKey,
  planRunKey,
  usePlanInputs,
  usePlanRun,
  type PlanRun,
} from './api'
import { applyReplace, replaceArgs, todayMoves } from './save'
import { buildPlanState, gainedToday, type PlanBlockRow } from './state'
import { usePlanStore } from './store'

/** Serial changes (several edits in a row) settle before replan (PRD "debounce 2 s"). */
const DEBOUNCE_MS = 2000

/**
 * Replan triggers (PRD "Kada se šta preračunava"): any change of a plan input — a saved edit
 * anywhere, a finished session, a calendar sync, the first opening of a new day — rebuilds the
 * state; when its hash differs from the latest plan run, the plan is computed in the browser and
 * saved through the offline queue (`replace_plan`). `replanNow()` saves even with the same hash
 * (a deleted AI block is not an input). Never while the timer runs.
 *
 * Today (decision, Stage 10b): today's free slots are in the hash and kept on the run. When they
 * changed since the last run, today's not-started AI blocks get new times from now (same content),
 * with a toast and undo.
 */
export function ReplanRunner() {
  const userId = useAuth().session?.user.id
  const { t } = useTranslation()
  const show = useToast((s) => s.show)
  const queryClient = useQueryClient()
  const boundary = useDayBoundary()
  const inputs = usePlanInputs(boundary)
  const run = usePlanRun()
  const active = useActiveSession()
  const nudge = usePlanStore((s) => s.nudge)
  const setModel = usePlanStore((s) => s.setModel)
  const setExtraToday = usePlanStore((s) => s.setExtraToday)
  const saving = useRef<string | null>(null)
  // The last nudge that was saved: a newer one replans even when the inputs did not change.
  const forced = useRef(0)
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
        const now = new Date()
        const usual = buildPlanState(inputs, { now, boundary })
        // The current minute only matters for today's first plan; it stays out of the hash so
        // an empty day does not save a new run every few minutes. The hash is always the usual
        // build's, so a re-placed day does not look changed on the next pass.
        const hash = inputHash({
          ...usual.state,
          nowMin: null,
          todaySlots: usual.todaySlotsKey,
          version: SCHEDULER_VERSION,
          models: { duration: DURATION_PRIORS.version },
        })
        const lastSlots = run.data?.today_slots ?? null
        const built =
          usual.keepToday && lastSlots !== null && lastSlots !== usual.todaySlotsKey
            ? buildPlanState(inputs, { now, boundary, replaceToday: true })
            : usual
        const result = plan(built.state)
        setModel({ built, hash, result })
        if (built.replacedToday && lastSlots !== null) {
          const gained = gainedToday(lastSlots, usual.todaySlotsKey, usual.state.nowMin ?? 0)
          if (gained >= inputs.profile.min_block_minutes)
            setExtraToday({
              date: usual.today,
              minutes: Math.min(120, Math.floor(gained / 15) * 15),
            })
        }
        if (active.data) return
        // A deleted AI block ("Prebaci") is not an input: same hash, but its work needs a place.
        const force = nudge !== forced.current
        if (saving.current === hash || (!force && run.data?.input_hash === hash)) return
        forced.current = nudge
        saving.current = hash
        const runId = crypto.randomUUID()
        const args = replaceArgs(built, result, hash, runId, boundary.timeZone)
        const cached = queryClient.getQueryData<PlanBlockRow[]>(planBlocksKey(userId)) ?? []
        const moves = todayMoves(built, result, cached)
        const timeOps = (list: { id: string; startMin: number | null }[]): Op[] =>
          list.map(({ id, startMin }) => ({
            kind: 'update',
            table: 'plan_blocks',
            match: { id },
            patch: {
              start_min: startMin,
              planned_start:
                startMin === null
                  ? null
                  : zonedInstant(built.today, startMin, boundary.timeZone).toISOString(),
            },
          }))
        const setTimes = (list: { id: string; startMin: number | null }[]) =>
          queryClient.setQueryData<PlanBlockRow[]>(planBlocksKey(userId), (old = []) =>
            old.map((b) => {
              const m = list.find((x) => x.id === b.id)
              return m ? { ...b, start_min: m.startMin } : b
            }),
          )
        const queue = syncQueueFor(userId)
        void queue
          .enqueue(
            { kind: 'rpc', table: 'plan_blocks', fn: 'replace_plan', args: { ...args } },
            {
              kind: 'update',
              table: 'plan_runs',
              match: { id: runId },
              patch: { today_slots: usual.todaySlotsKey },
            },
            ...timeOps(moves.map((m) => ({ id: m.block.id, startMin: m.startMin }))),
          )
          .then(() => {
            queryClient.setQueryData<PlanBlockRow[]>(planBlocksKey(userId), (old) =>
              applyReplace(old ?? [], args, userId),
            )
            if (moves.length > 0) {
              setTimes(moves.map((m) => ({ id: m.block.id, startMin: m.startMin })))
              const first = moves[0]!
              const name =
                inputs.subjects.find((x) => x.id === first.block.subject_id)?.name.split(' ')[0] ??
                ''
              const back = moves.map((m) => ({ id: m.block.id, startMin: m.block.start_min }))
              show(t('today.replaced', { subject: name, time: formatClock(first.startMin) }), {
                label: t('today.cant.undo'),
                run: () => {
                  setTimes(back)
                  void queue.enqueue(...timeOps(back)).then(() => queue.flush())
                },
              })
            }
            const saved: PlanRun = {
              id: runId,
              input_hash: hash,
              deficit: args.p_deficit,
              created_at: new Date().toISOString(),
              today_slots: usual.todaySlotsKey,
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
    setExtraToday,
    queryClient,
    show,
    t,
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
