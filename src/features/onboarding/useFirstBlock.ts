import { useEffect, useState } from 'react'
import { usePlanRun } from '@/features/plan/api'
import { nextBlock, type UnitInfo } from '@/features/plan/model'
import type { PlanBlockRow } from '@/features/plan/state'
import { usePlanStore } from '@/features/plan/store'
import { usePlanToday } from '@/features/today/usePlanToday'

/** Without a saved plan by then (offline start, slow network) step 8 offers a free session. */
const WAIT_MS = 12_000

export type FirstBlock =
  | { status: 'pending' }
  | { status: 'none' }
  | { status: 'block'; block: PlanBlockRow; units: Map<string, UnitInfo> }

/**
 * Today's first block for onboarding step 8. Pending until ReplanRunner has computed a plan with
 * the exam and material from step 7 and its blocks are saved (the run carries the model's hash).
 */
export function useFirstBlock(
  goal: { id: string; subjectId: string; hasMaterial: boolean } | null,
): FirstBlock {
  const plan = usePlanToday()
  const model = usePlanStore((s) => s.model)
  const run = usePlanRun().data
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), WAIT_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!goal) return { status: 'none' }
  const state = model?.built.state
  const fresh =
    state !== undefined &&
    state.goals.some((g) => g.id === goal.id) &&
    (!goal.hasMaterial || state.units.some((u) => u.subjectId === goal.subjectId)) &&
    run?.input_hash === model?.hash
  if (!fresh || !plan.loaded) return timedOut ? { status: 'none' } : { status: 'pending' }
  const block = nextBlock(plan.todayBlocks, plan.nowMin)
  return block ? { status: 'block', block, units: plan.units } : { status: 'none' }
}
