import { difficultyMultiplier } from '@/lib/estimates'
import {
  addSamples,
  type LearnedRate,
  type RateSample,
  type StudyMode,
} from '@/lib/estimates/calibration'
import { allocateMinutes, type AllocationUnit } from '@/lib/session/allocate'
import { coverage, type Covered, type Point } from '@/lib/session/coverage'
import { activeMs, MINUTE, msByUnit, pauseStats } from '@/lib/session/timer'
import type { Measure } from '@/lib/outline/parse'
import type { Op, Row } from '@/lib/sync'
import { toSegment, type SegmentRow, type SessionRow } from './model'

/**
 * End of a session (KrajSesije): "do koje stranice" → amount per unit, minutes split over units
 * (`session_units`), unit status and difficulty, and calibration of every source studied
 * (PRD "Procjena težine i vremena"). Returns the ops for the offline queue.
 */

export interface EndUnit {
  id: string
  kind: 'chapter' | 'question'
  amount: number
  level: number
  /** Estimated difficulty (rated, or prior corrected by the source's ratings). */
  difficulty: number
  completedAt: string | null
}

export interface EndSource {
  id: string
  measure: Measure
  /** Heuristic minutes per unit of measure, for weights across sources. */
  rate: number
  learned: LearnedRate
  measuredSessions: number
  /** Calibration of this source × the session's mode; null = not known (offline), left as is. */
  pair: LearnedRate | null
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
  reflection: string
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

export interface EndPlan {
  ops: Op[]
  /** Minutes per unit, for the cards ("28 min"). */
  minutes: Map<string, number>
}

const round2 = (x: number) => Math.round(x * 100) / 100

export function planEnd(
  session: SessionRow,
  segments: SegmentRow[],
  sources: EndSource[],
  answers: EndAnswers,
  now: Date = new Date(),
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
  const samples = new Map<string, RateSample[]>()

  for (const id of touched) {
    const { unit, source } = unitInfo.get(id)!
    const amountDone = covered.get(id)?.amountDone ?? 0
    const min = minutes.get(id) ?? 0
    const levelAfter = answers.levels[id] ?? defaultLevel(unit, covered.get(id))
    const rating = answers.ratings[id] ?? null
    sessionUnits.push({
      session_id: session.id,
      unit_id: id,
      minutes: round2(min),
      amount_done: amountDone,
      level_before: unit.level,
      level_after: levelAfter,
      difficulty: rating,
    })
    const patch: Row = {}
    if (levelAfter !== unit.level) {
      patch.level = levelAfter
      if (levelAfter >= 1 && !unit.completedAt) patch.completed_at = t
    }
    if (rating !== null) patch.user_difficulty = rating
    if (Object.keys(patch).length > 0)
      unitOps.push({ kind: 'update', table: 'units', match: { id }, patch })
    if (amountDone > 0 && min > 0)
      samples.set(source.id, [
        ...(samples.get(source.id) ?? []),
        { minutes: min, amountDone, difficulty: difficultyOf(unit) },
      ])
  }

  const calibrationOps: Op[] = []
  for (const [sourceId, list] of samples) {
    const source = sources.find((s) => s.id === sourceId)!
    const learned = addSamples(source.learned, list)
    calibrationOps.push({
      kind: 'update',
      table: 'sources',
      match: { id: sourceId },
      patch: {
        learned_min_per_unit: learned.rate,
        learned_samples: learned.samples,
        measured_sessions: source.measuredSessions + 1,
      },
    })
    if (session.mode && source.pair) {
      const pair = addSamples(source.pair, list)
      calibrationOps.push({
        kind: 'upsert',
        table: 'source_mode_rates',
        onConflict: 'source_id,mode',
        rows: [
          {
            source_id: sourceId,
            mode: session.mode satisfies StudyMode,
            min_per_unit: pair.rate,
            samples: pair.samples,
          },
        ],
      })
    }
  }

  const ops: Op[] = [
    {
      kind: 'upsert',
      table: 'study_sessions',
      rows: [
        {
          ...session,
          focus: answers.focus,
          reflection: answers.reflection.trim() || null,
          updated_at: t,
        } as unknown as Row,
      ],
    },
  ]
  if (sessionUnits.length > 0)
    ops.push({
      kind: 'upsert',
      table: 'session_units',
      onConflict: 'session_id,unit_id',
      rows: sessionUnits,
    })
  ops.push(...unitOps, ...calibrationOps)
  return { ops, minutes }
}
