import { weekdayOf, type LocalDate } from '@/lib/day'
import { blockLabel, type BlockStatus } from '@/lib/ml/labels'
import { LATE_AFTER_MIN } from '@/lib/scheduler/shift'
import type { BlockKind } from '@/lib/scheduler/types'
import { partOf } from '@/lib/schedule/rhythm'
import type { CompletionExample } from './completion'

/**
 * Labelled examples for the completion model from saved rows, as `block_examples()` in
 * `ml/hoot_ml/data.py`: one per AI block with a label (its plan-time features), plus one explicit
 * "skipped" per "Preskoči" (`block_skips`, the slot it left). A block's previous one that day was
 * late when it was started more than `LATE_AFTER_MIN` after its planned start.
 */

export interface ExampleBlock {
  id: string
  subjectId: string
  onDate: LocalDate
  kind: BlockKind
  status: BlockStatus
  origin: 'ai' | 'user'
  /** Start the plan gave it (`plan_start_min`); null for blocks saved before Stage 11a. */
  planStartMin: number | null
  plannedStart: string | null
  dayLoadMin: number | null
  daysToGoal: number | null
  demand: number | null
}

export interface ExampleSkip {
  subjectId: string
  onDate: LocalDate
  kind: BlockKind
  startMin: number | null
  dayLoadMin: number | null
  daysToGoal: number | null
  demand: number | null
}

export interface ExampleSession {
  blockId: string | null
  startedAt: string
}

const MINUTE_MS = 60_000

export function completionExamples(
  blocks: ExampleBlock[],
  skips: ExampleSkip[],
  sessions: ExampleSession[],
  today: LocalDate,
): CompletionExample[] {
  const firstStart = new Map<string, number>()
  for (const s of sessions) {
    if (!s.blockId) continue
    const t = Date.parse(s.startedAt)
    const prev = firstStart.get(s.blockId)
    if (prev === undefined || t < prev) firstStart.set(s.blockId, t)
  }
  const late = (b: ExampleBlock) => {
    const start = firstStart.get(b.id)
    if (start === undefined || !b.plannedStart) return false
    return (start - Date.parse(b.plannedStart)) / MINUTE_MS > LATE_AFTER_MIN
  }

  const ai = blocks
    .filter((b) => b.origin === 'ai' && b.planStartMin !== null)
    .sort((a, b) =>
      a.onDate < b.onDate ? -1 : a.onDate > b.onDate ? 1 : a.planStartMin! - b.planStartMin!,
    )
  const out: CompletionExample[] = []
  let prev: ExampleBlock | null = null
  for (const b of ai) {
    const prevLate = prev !== null && prev.onDate === b.onDate && late(prev)
    prev = b
    const label = blockLabel(
      { status: b.status, onDate: b.onDate, hasSession: firstStart.has(b.id) },
      today,
    )
    if (!label) continue
    out.push({
      subjectId: b.subjectId,
      onDate: b.onDate,
      label,
      part: partOf(b.planStartMin!),
      weekend: weekdayOf(b.onDate) >= 5,
      kind: b.kind,
      demand: b.demand ?? 1,
      dayLoadMin: b.dayLoadMin ?? 0,
      daysToGoal: b.daysToGoal,
      prevLate,
    })
  }
  for (const s of skips) {
    if (s.startMin === null) continue
    out.push({
      subjectId: s.subjectId,
      onDate: s.onDate,
      label: 'skipped',
      part: partOf(s.startMin),
      weekend: weekdayOf(s.onDate) >= 5,
      kind: s.kind,
      demand: s.demand ?? 1,
      dayLoadMin: s.dayLoadMin ?? 0,
      daysToGoal: s.daysToGoal,
      prevLate: false,
    })
  }
  return out
}
