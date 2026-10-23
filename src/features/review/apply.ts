import { addDays, diffDays, type DayBoundary, type LocalDate } from '@/lib/day'
import {
  combineRecall,
  levelAfter,
  READ_CHECK_DAYS,
  retrievabilityOn,
  review,
  targetRetention,
  type Recall,
} from '@/lib/srs'
import type { Op, Row } from '@/lib/sync'
import type { Card, Unit } from '@/features/sources/model'
import type { Enums } from '@/types/database'
import type { ReviewLimit } from './limits'
import { memoryColumns, memoryOf } from './memory'

/**
 * Writing reviews (PRD "Spaced repetition"): every rated unit and card gets its new FSRS state,
 * next review day and a `review_logs` row; chapters and questions also get their new level. Pure:
 * returns ops for the offline queue and the outcome per item for the summary.
 */

export type RecallSource = Enums<'recall_source'>

/** Most precise first: the chapter's log names the best test it had. */
const PRECISION: RecallSource[] = [
  'outline',
  'exam_question',
  'notes',
  'page_photo',
  'card',
  'blurt',
  'general',
]

export interface UnitReview {
  unit: Unit
  /** Every rating that tested this unit in the gate (combined to one grade). */
  recalls: { recall: Recall; source: RecallSource }[]
}

export interface CardReview {
  card: Card
  unit: Unit
  recall: Recall
}

export interface ReviewContext {
  today: LocalDate
  /** When the reviews happened (the logs' `reviewed_at`). */
  at: string
  boundary: DayBoundary
  limits: Map<string, ReviewLimit>
}

export interface Outcome {
  id: string
  kind: 'unit' | 'card'
  unitId: string
  recall: Recall
  levelBefore: number
  levelAfter: number
  /** Strength before (null for the first test) and tomorrow after the review. */
  strengthBefore: number | null
  strengthAfter: number
  nextReviewOn: LocalDate | null
  /** A chapter that failed goes back to learning. */
  relearn: boolean
}

export interface ReviewPlan {
  ops: Op[]
  outcomes: Outcome[]
}

const round = (x: number) => Math.round(x * 10000) / 10000

function bestSource(recalls: UnitReview['recalls']): RecallSource {
  for (const s of PRECISION) if (recalls.some((r) => r.source === s)) return s
  return recalls[0]?.source ?? 'blurt'
}

export function planReviews(
  units: UnitReview[],
  cards: CardReview[],
  ctx: ReviewContext,
): ReviewPlan {
  const ops: Op[] = []
  const logs: Row[] = []
  const outcomes: Outcome[] = []
  const tomorrow = addDays(ctx.today, 1)
  const limitOf = (unitId: string) => ctx.limits.get(unitId) ?? { priority: 3, lastDay: null }

  for (const { unit, recalls } of units) {
    const recall = combineRecall(recalls.map((r) => r.recall))
    if (recall === null) continue
    const kind = unit.kind === 'question' ? 'question' : 'chapter'
    const limit = limitOf(unit.id)
    const before = memoryOf(unit, ctx.boundary)
    const r = review({
      memory: before,
      recall,
      today: ctx.today,
      retention: targetRetention(limit.priority, kind),
      lastDay: limit.lastDay,
    })
    let level = levelAfter(kind, unit.level, recall, r.memory.streak)
    // General knowledge may differ from the lectures: it moves a chapter up only together with
    // another test (PRD "Testiranje bez sadržaja literature").
    if (recalls.every((x) => x.source === 'general') && level > unit.level)
      level = Math.max(unit.level, Math.min(level, 1))
    // A chapter that failed waits for its learning block; reading it again offers the gate.
    const relearn = kind === 'chapter' && recall === 0
    const nextReviewOn = relearn ? null : r.nextReviewOn
    const patch: Row = {
      ...memoryColumns(r.memory, ctx.at),
      next_review_on: nextReviewOn,
      updated_at: ctx.at,
    }
    if (level !== unit.level) {
      patch.level = level
      if (level >= 1 && !unit.completed_at) patch.completed_at = ctx.at
    }
    ops.push({ kind: 'update', table: 'units', match: { id: unit.id }, patch })
    logs.push(
      logRow(unit.id, null, bestSource(recalls), recall, unit.next_review_on, before, r, ctx),
    )
    outcomes.push({
      id: unit.id,
      kind: 'unit',
      unitId: unit.id,
      recall,
      levelBefore: unit.level,
      levelAfter: level,
      strengthBefore: r.retrievabilityBefore,
      strengthAfter: retrievabilityOn(r.memory, tomorrow),
      nextReviewOn,
      relearn,
    })
  }

  for (const { card, unit, recall } of cards) {
    const limit = limitOf(unit.id)
    const before = memoryOf(card, ctx.boundary)
    const r = review({
      memory: before,
      recall,
      today: ctx.today,
      retention: targetRetention(limit.priority, 'card'),
      lastDay: limit.lastDay,
    })
    ops.push({
      kind: 'update',
      table: 'cards',
      match: { id: card.id },
      patch: {
        ...memoryColumns(r.memory, ctx.at),
        next_review_on: r.nextReviewOn,
        updated_at: ctx.at,
      },
    })
    logs.push(logRow(unit.id, card.id, 'card', recall, card.next_review_on, before, r, ctx))
    outcomes.push({
      id: card.id,
      kind: 'card',
      unitId: unit.id,
      recall,
      levelBefore: unit.level,
      levelAfter: unit.level,
      strengthBefore: r.retrievabilityBefore,
      strengthAfter: retrievabilityOn(r.memory, tomorrow),
      nextReviewOn: r.nextReviewOn,
      relearn: false,
    })
  }

  if (logs.length > 0) ops.push({ kind: 'upsert', table: 'review_logs', rows: logs })
  return { ops, outcomes }
}

function logRow(
  unitId: string,
  cardId: string | null,
  source: RecallSource,
  recall: Recall,
  dueOn: string | null,
  before: ReturnType<typeof memoryOf>,
  r: ReturnType<typeof review>,
  ctx: ReviewContext,
): Row {
  return {
    id: crypto.randomUUID(),
    unit_id: unitId,
    card_id: cardId,
    reviewed_at: ctx.at,
    source,
    recall,
    // Due for a check (the plan put it there) vs. tested right after reading or on demand.
    was_scheduled: dueOn !== null && dueOn <= ctx.today,
    interval_before:
      before && dueOn !== null ? Math.max(0, diffDays(before.lastReviewOn, dueOn)) : null,
    interval_after: diffDays(ctx.today, r.nextReviewOn),
    elapsed_days: r.elapsedDays,
    stability_before: r.stabilityBefore === null ? null : round(r.stabilityBefore),
    stability_after: round(r.stabilityAfter),
  }
}

/**
 * A chapter read in a session without its recall gate: the check of what was read is due in 2
 * days, unless an earlier check is already planned.
 */
export function readCheckOn(today: LocalDate, current: string | null): LocalDate {
  const on = addDays(today, READ_CHECK_DAYS)
  return current !== null && current < on ? current : on
}
