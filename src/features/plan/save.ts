import { zonedInstant } from '@/lib/day'
import type { PlanResult, Reason } from '@/lib/scheduler'
import type { Realization } from '@/lib/scheduler'
import type { BuiltState, PlanBlockRow } from './state'

/** What `plan_runs.deficit` keeps besides the deficits: the plan's own explanation. */
export interface RunSummary {
  deficits: PlanResult['deficits']
  campaignStarts: PlanResult['campaignStarts']
  computedStarts: PlanResult['computedStarts']
  fixedTimes: PlanResult['fixedTimes']
  realization: Realization
  /** Planned share of free time, for "planiram 80% jer…". */
  rho: number
}

export interface ReplaceArgs {
  p_run_id: string
  p_input_hash: string
  p_deficit: RunSummary
  p_today: string
  p_from: string
  p_blocks: {
    id: string
    subject_id: string
    assessment_id: string | null
    deadline_id: string | null
    on_date: string
    start_min: number | null
    planned_start: string | null
    planned_minutes: number
    kind: PlanBlockRow['kind']
    reason: string
  }[]
  p_units: {
    block_id: string
    unit_id: string
    page_from: number | null
    page_to: number | null
    planned_minutes: number
  }[]
}

/** A plan result → arguments of `replace_plan()`; ids come from `newId` (the client). */
export function replaceArgs(
  built: BuiltState,
  result: PlanResult,
  hash: string,
  runId: string,
  timeZone: string,
  newId: () => string = () => crypto.randomUUID(),
): ReplaceArgs {
  const kinds = new Map(built.state.goals.map((g) => [g.id, g.kind]))
  const blocks: ReplaceArgs['p_blocks'] = []
  const units: ReplaceArgs['p_units'] = []
  for (const b of result.blocks) {
    const id = newId()
    const kind = b.goalId ? kinds.get(b.goalId) : undefined
    blocks.push({
      id,
      subject_id: b.subjectId,
      assessment_id: kind === 'exam' ? b.goalId : null,
      deadline_id: kind === 'deadline' ? b.goalId : null,
      on_date: b.onDate,
      start_min: b.startMin,
      planned_start:
        b.startMin === null ? null : zonedInstant(b.onDate, b.startMin, timeZone).toISOString(),
      planned_minutes: b.minutes,
      kind: b.kind,
      reason: JSON.stringify(b.reason),
    })
    for (const u of b.units)
      units.push({
        block_id: id,
        unit_id: u.unitId,
        page_from: u.pageFrom,
        page_to: u.pageTo,
        planned_minutes: Math.max(1, Math.round(u.minutes)),
      })
  }
  return {
    p_run_id: runId,
    p_input_hash: hash,
    p_deficit: {
      deficits: result.deficits,
      campaignStarts: result.campaignStarts,
      computedStarts: result.computedStarts,
      fixedTimes: result.fixedTimes,
      realization: built.realization,
      rho: built.state.rho,
    },
    p_today: built.today,
    p_from: built.state.from,
    p_blocks: blocks,
    p_units: units,
  }
}

/**
 * The cached block list after `replace_plan()`: past planned blocks become missed, future
 * unstarted AI blocks are replaced by the new ones (manual and finished blocks stay).
 */
export function applyReplace(
  old: PlanBlockRow[],
  args: ReplaceArgs,
  userId: string,
): PlanBlockRow[] {
  const now = new Date().toISOString()
  const kept = old
    .filter((b) => !(b.origin === 'ai' && b.status === 'planned' && b.on_date >= args.p_from))
    .map((b) =>
      b.on_date < args.p_today && b.status === 'planned' ? { ...b, status: 'missed' as const } : b,
    )
  const fresh: PlanBlockRow[] = args.p_blocks.map((b) => ({
    ...b,
    user_id: userId,
    status: 'planned',
    origin: 'ai',
    title: null,
    plan_run_id: args.p_run_id,
    created_at: now,
    updated_at: now,
    plan_block_units: args.p_units
      .filter((u) => u.block_id === b.id)
      .map((u) => ({ ...u, user_id: userId })),
  }))
  return [...kept, ...fresh]
}

/** The block's "zašto ovo danas" (stored as JSON in `plan_blocks.reason`). */
export function reasonOf(block: Pick<PlanBlockRow, 'reason'>): Reason | null {
  if (!block.reason) return null
  try {
    const r = JSON.parse(block.reason) as Reason
    return typeof r === 'object' && r && typeof r.code === 'string' ? r : null
  } catch {
    return null
  }
}
