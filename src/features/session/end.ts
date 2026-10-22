import { difficultyMultiplier } from '@/lib/estimates'
import { allocateMinutes, type AllocationUnit } from '@/lib/session/allocate'
import { coverage, type Covered, type Point } from '@/lib/session/coverage'
import { activeMs, MINUTE, msByUnit, pauseStats } from '@/lib/session/timer'
import type { LocalDate } from '@/lib/day'
import type { Measure } from '@/lib/outline/parse'
import { readCheckOn } from '@/features/review/apply'
import type { Op, Row } from '@/lib/sync'
import { toSegment, type SegmentRow, type SessionRow } from './model'

/**
 * End of a session (KrajSesije): "do koje stranice" → amount per unit, minutes split over units
 * (`session_units`), unit status and difficulty. Returns the ops for the offline queue. Speed
 * calibration is recomputed afterwards from all sessions (`recalibrate.ts`).
 */

export interface EndUnit {
  id: string
  kind: 'chapter' | 'question'
  amount: number
  level: number
  /** Estimated difficulty (rated, or prior corrected by the source's ratings). */
  difficulty: number
  completedAt: string | null
  /** Planned check (FSRS or the check of what was read). */
  nextReviewOn: string | null
  /** Last test; a unit tested during this session is not offered the gate again. */
  lastReviewAt: string | null
}

export interface EndSource {
  id: string
  measure: Measure
  /** Minutes per unit of measure, for weights across sources. */
  rate: number
  /** Leaves in source order. */
  units: EndUnit[]
}

export interface Range {
  sourceId: string
  from: Point
  to: Point
}

export interface EndAnswers {
  ranges: Range[]
  /** Difficulty 1–5 per unit, only the ones the user tapped. */
  ratings: Record<string, number>
  /** Status per unit after the session (chip on the card). */
  levels: Record<string, number>
  focus: number | null
  /** Why focus was low (only kept with focus 1). */
  focusReasons: string[]
  reflection: string
  /** "Samo spasi": the recall gate of the units read is skipped (recorded with the session). */
  skipGate?: boolean
}

/** Covered amount per unit for every range, keyed by unit id. */
export function coveredUnits(sources: EndSource[], ranges: Range[]): Map<string, Covered> {
  const out = new Map<string, Covered>()
  for (const r of ranges) {
    const source = sources.find((s) => s.id === r.sourceId)
    if (!source) continue
    for (const c of coverage(source.units, r.from, r.to)) out.set(c.unitId, c)
  }
  return out
}

/**
 * Statuses the chip on the end form cycles through: "Razumijem" and "Ponovljeno" (questions:
 * "Znam") come only from the recall gate, so they are offered only to keep a level the unit has.
 */
export function endLevels(level: number): number[] {
  return level > 1 ? [0, 1, level] : [0, 1]
}

/** A chapter read to its end becomes "Pročitano" if it was not started (PRD decision, Stage 7). */
export function defaultLevel(unit: Pick<EndUnit, 'kind' | 'level'>, covered: Covered | undefined) {
  if (unit.kind === 'chapter' && unit.level === 0 && covered?.complete) return 1
  return unit.level
}

export interface EndSummary {
  activeMin: number
  pauses: number
  pauseMin: number
}

export function summarize(session: SessionRow, segments: SegmentRow[], now: Date): EndSummary {
  const list = segments.map(toSegment)
  const end = session.ended_at ? new Date(session.ended_at) : now
  const stats = pauseStats(list, end, end)
  return {
    activeMin: activeMs(list, end) / MINUTE,
    pauses: stats.count,
    pauseMin: stats.ms / MINUTE,
  }
}

/** A saved `session_units` row (editing a session from the history). */
export interface SavedUnit {
  unit_id: string
  minutes: number
  amount_done: number | null
  level_before: number | null
  level_after: number | null
  difficulty: number | null
}

export interface EndPlan {
  ops: Op[]
  /** Minutes per unit, for the cards ("28 min"). */
  minutes: Map<string, number>
  /** Units read to their end in this session and not tested yet: the recall gate offers them. */
  gate: string[]
}

const round2 = (x: number) => Math.round(x * 100) / 100

export function planEnd(
  session: SessionRow,
  segments: SegmentRow[],
  sources: EndSource[],
  answers: EndAnswers,
  now: Date = new Date(),
  saved: SavedUnit[] = [],
  /** Local day of the session; with it a chapter read without its gate gets a check in 2 days. */
  today: LocalDate | null = null,
): EndPlan {
  const end = session.ended_at ? new Date(session.ended_at) : now
  const byUnit = msByUnit(segments.map(toSegment), end)
  const minutesByUnit = new Map([...byUnit].map(([k, ms]) => [k, ms / MINUTE]))
  const covered = coveredUnits(sources, answers.ranges)

  const unitInfo = new Map<string, { unit: EndUnit; source: EndSource }>()
  for (const source of sources)
    for (const unit of source.units) unitInfo.set(unit.id, { unit, source })

  const difficultyOf = (u: EndUnit) => answers.ratings[u.id] ?? u.difficulty
  const touched = new Set<string>([...covered.keys()])
  for (const id of minutesByUnit.keys()) if (id && unitInfo.has(id)) touched.add(id)

  const allocationUnits: AllocationUnit[] = [...touched].map((id) => {
    const { unit, source } = unitInfo.get(id)!
    const amountDone = covered.get(id)?.amountDone ?? 0
    return {
      id,
      sourceId: source.id,
      position: source.units.findIndex((u) => u.id === id),
      amountDone,
      weight: amountDone * source.rate * difficultyMultiplier(difficultyOf(unit)),
    }
  })
  const { minutes } = allocateMinutes(minutesByUnit, allocationUnits)

  const t = now.toISOString()
  const sessionUnits: Row[] = []
  const unitOps: Op[] = []
  const savedBy = new Map(saved.map((r) => [r.unit_id, r]))
  const gate: string[] = []

  for (const id of touched) {
    const { unit } = unitInfo.get(id)!
    const amountDone = covered.get(id)?.amountDone ?? 0
    const min = minutes.get(id) ?? 0
    const levelAfter = answers.levels[id] ?? defaultLevel(unit, covered.get(id))
    const testedNow = unit.lastReviewAt !== null && unit.lastReviewAt >= session.started_at
    const read = covered.get(id)?.complete === true && levelAfter >= 1 && !testedNow
    if (read) gate.push(id)
    const rating = answers.ratings[id] ?? null
    sessionUnits.push({
      session_id: session.id,
      unit_id: id,
      minutes: round2(min),
      amount_done: amountDone,
      // Editing keeps the status the unit had before this session.
      level_before: savedBy.get(id)?.level_before ?? unit.level,
      level_after: levelAfter,
      difficulty: rating,
      recall_skipped: read && answers.skipGate === true,
    })
    const patch: Row = {}
    // A chapter read (again) without passing its gate: the check of what was read in 2 days.
    if (read && today !== null && unit.kind === 'chapter' && levelAfter <= 1) {
      const on = readCheckOn(today, unit.nextReviewOn)
      if (on !== unit.nextReviewOn) patch.next_review_on = on
    }
    if (levelAfter !== unit.level) {
      patch.level = levelAfter
      if (levelAfter >= 1 && !unit.completedAt) patch.completed_at = t
    }
    if (rating !== null) patch.user_difficulty = rating
    if (Object.keys(patch).length > 0)
      unitOps.push({ kind: 'update', table: 'units', match: { id }, patch })
  }

  const ops: Op[] = [
    {
      kind: 'upsert',
      table: 'study_sessions',
      rows: [
        {
          ...session,
          focus: answers.focus,
          focus_reasons:
            answers.focus === 1 && answers.focusReasons.length > 0 ? answers.focusReasons : null,
          reflection: answers.reflection.trim() || null,
          updated_at: t,
        } as unknown as Row,
      ],
    },
  ]
  // Editing replaces the saved rows: units no longer covered drop out.
  if (saved.length > 0)
    ops.push({ kind: 'delete', table: 'session_units', match: { session_id: session.id } })
  if (sessionUnits.length > 0)
    ops.push({
      kind: 'upsert',
      table: 'session_units',
      onConflict: 'session_id,unit_id',
      rows: sessionUnits,
    })
  ops.push(...unitOps)
  return { ops, minutes, gate }
}

/**
 * Minutes per unit after the segments of a saved session were edited: the same covered amounts,
 * split again over the new times.
 */
export function reallocate(
  segments: SegmentRow[],
  sources: EndSource[],
  saved: SavedUnit[],
  end: Date,
): Map<string, number> {
  const byUnit = msByUnit(segments.map(toSegment), end)
  const minutesByUnit = new Map([...byUnit].map(([k, ms]) => [k, ms / MINUTE]))
  const units: AllocationUnit[] = []
  for (const row of saved) {
    for (const source of sources) {
      const position = source.units.findIndex((u) => u.id === row.unit_id)
      if (position < 0) continue
      const unit = source.units[position]!
      const amountDone = Number(row.amount_done ?? 0)
      units.push({
        id: unit.id,
        sourceId: source.id,
        position,
        amountDone,
        weight: amountDone * source.rate * difficultyMultiplier(row.difficulty ?? unit.difficulty),
      })
    }
  }
  return allocateMinutes(minutesByUnit, units).minutes
}

/** Ranges back from saved amounts: per source from the first to the last covered unit. */
export function savedRanges(sources: EndSource[], saved: SavedUnit[]): Range[] {
  const done = new Map(saved.map((r) => [r.unit_id, Number(r.amount_done ?? 0)]))
  const out: Range[] = []
  for (const source of sources) {
    const covered = source.units.filter((u) => (done.get(u.id) ?? 0) > 0)
    if (covered.length === 0) continue
    const first = covered[0]!
    const last = covered.at(-1)!
    const firstDone = done.get(first.id)!
    out.push({
      sourceId: source.id,
      // Several units: the first was read to its end; one unit: read from its start.
      from: { unitId: first.id, offset: covered.length > 1 ? first.amount - firstDone : 0 },
      to: { unitId: last.id, offset: covered.length > 1 ? done.get(last.id)! : firstDone },
    })
  }
  return out
}
