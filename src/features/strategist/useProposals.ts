import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { useQueueWrite } from '@/features/plan/actions'
import { invalidatePlanInputs } from '@/features/plan/api'
import { usePlanStore } from '@/features/plan/store'
import { useProgress } from '@/features/progress/useProgress'
import { scheduleKey } from '@/features/schedule/api'
import { profileKey } from '@/features/settings/profile'
import { subjectsKey } from '@/features/subjects/api'
import { weekWindow } from '@/lib/progress/week'
import type { Op } from '@/lib/sync'
import { latestFeedback, useFeedback, useRecordFeedback } from './feedback'
import { acceptedThisWeek } from './feedbackInputs'
import { useInsightData } from './useInsights'
import { useApplyAction } from './useApplyAction'
import { useStrategist } from './useStrategist'
import { collectSuggestions, movedWork, type Suggestion } from './suggestions'

/** Actions accepted per week (PRD "Sedmični check-in": up to 3). */
const WEEKLY_ACTIONS = 3

function storedRevert(payload: unknown): Op[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const revert = (payload as { revert?: unknown }).revert
  return Array.isArray(revert) ? (revert as Op[]) : []
}

/**
 * Prijedlozi: strategist candidates, insights with an action and the work the replan already
 * moved, with every decision kept in `progress_feedback` and reversible. An approval stores the
 * writes that undo it, so "Vrati odluku" puts the inputs back instead of only hiding the card.
 */
export function useProposals() {
  const data = useProgress()
  const strategy = useStrategist()
  const insight = useInsightData()
  const rows = useFeedback().data
  const apply = useApplyAction()
  const record = useRecordFeedback()
  const write = useQueueWrite()
  const queryClient = useQueryClient()
  const userId = useAuth().session?.user.id
  const replan = usePlanStore((s) => s.replanNow)
  const [busy, setBusy] = useState(false)
  const window = data ? weekWindow(data.today) : null

  const live = useMemo((): Suggestion[] => {
    if (!data || !window) return []
    const subjectOf = (id: string | null) =>
      id && data.inputs.subjects.some((s) => s.id === id) ? id : null
    return [
      ...strategy.selected.map((c): Suggestion => ({
        id: c.id,
        kind: 'ask',
        from: 'strategist',
        subjectId: subjectOf('subjectId' in c.action ? c.action.subjectId : null),
        candidate: { id: c.id, rule: c.rule, action: c.action, effect: c.effect },
        reason: c.reason,
      })),
      ...(insight?.list ?? [])
        .filter((i) => i.action)
        .map((i): Suggestion => ({
          id: i.id,
          kind: 'ask',
          from: 'insight',
          subjectId: subjectOf('subjectId' in i ? i.subjectId : null),
          insight: i,
        })),
      ...movedWork(data.inputs.blocks, window.from, data.today).map((moved): Suggestion => ({
        id: `replan:${moved.missedId}`,
        kind: 'done',
        from: 'replan',
        subjectId: moved.subjectId,
        moved,
      })),
    ]
  }, [data, window, strategy.selected, insight])

  const list = useMemo(
    () => (data && rows ? collectSuggestions(live, rows, data.today) : []),
    [data, rows, live],
  )
  const week = window?.nextFrom ?? ''
  const asksLeft = Math.max(0, WEEKLY_ACTIONS - acceptedThisWeek(rows ?? [], week))

  const runOps = async (ops: Op[]) => {
    if (!ops.length) return
    await write(ops)
    await Promise.all([
      invalidatePlanInputs(queryClient, userId),
      queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
      queryClient.invalidateQueries({ queryKey: profileKey(userId) }),
      ...(['availability_days', 'availability_rules', 'availability_exceptions'] as const).map(
        (table) => queryClient.invalidateQueries({ queryKey: scheduleKey(table, userId) }),
      ),
    ])
    replan()
  }
  const save = (s: Suggestion, status: 'accepted' | 'rejected', extra: object = {}) =>
    record.mutateAsync({
      ...(s.from === 'strategist' ? { candidateId: s.id } : { insightId: s.id }),
      status,
      payload: { suggestion: s, ...extra },
    })
  const actionOf = (s: Suggestion) =>
    s.from === 'strategist' ? s.candidate.action : s.from === 'insight' ? s.insight.action : null
  const step = (run: () => Promise<unknown>) => {
    setBusy(true)
    return run().finally(() => setBusy(false))
  }

  /** "Primijeni" on an ask, "U redu" on what Hoot did. */
  const approveOne = async (s: Suggestion) => {
    const action = actionOf(s)
    if (s.kind === 'done' || !action) return void (await save(s, 'accepted'))
    const revert = await apply.mutateAsync(action)
    await save(s, 'accepted', { action, week, revert })
  }

  return {
    ready: Boolean(data && rows && window),
    window,
    list,
    asksLeft,
    busy: busy || apply.isPending || record.isPending,
    error: apply.isError || record.isError,
    strategy,
    approve: (s: Suggestion) => step(() => approveOne(s)),
    /** "Potvrdi N": one after another, so each replan sees the previous change. */
    approveAll: (items: Suggestion[]) =>
      step(async () => {
        for (const s of items) await approveOne(s)
      }),
    decline: (s: Suggestion) => step(() => save(s, 'rejected')),
    /** "Poništi" on what Hoot did: its material leaves the plan for that exam. */
    undo: (s: Suggestion) =>
      step(async () => {
        if (s.kind !== 'done') return
        const revert = await apply.mutateAsync({
          kind: 'drop_unit',
          goalId: s.moved.goalId,
          unitIds: s.moved.unitIds,
        })
        await save(s, 'rejected', { revert })
      }),
    /** "Vrati odluku" / "Vrati": the inputs go back and the suggestion is open again. */
    takeBack: (s: Suggestion) =>
      step(async () => {
        const latest = latestFeedback(rows ?? [], s.id)
        if (latest?.status === 'accepted') await runOps(storedRevert(latest.payload))
        await save(s, 'rejected', { reverted: true })
      }),
    /** "Ipak primijeni" after "Poništi": the material comes back into the plan. */
    applyAgain: (s: Suggestion) =>
      step(async () => {
        await runOps(storedRevert(latestFeedback(rows ?? [], s.id)?.payload))
        await save(s, 'accepted')
      }),
  }
}
