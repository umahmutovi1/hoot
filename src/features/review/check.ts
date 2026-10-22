import { diffDays, type LocalDate } from '@/lib/day'
import type { Recall } from '@/lib/srs'
import type { Card, Unit } from '@/features/sources/model'
import type { CardReview, Outcome, RecallSource, UnitReview } from './apply'

/**
 * Provjera znanja (PRD "Provjera znanja"): a review block as a series of recall gates, one item
 * per unit and one per due card. A chapter is asked through the most precise test it has: a
 * linked exam question with an answer, else its notes, else free recall.
 */

export type CheckSource = 'exam_question' | 'notes' | 'recall' | 'question' | 'card'

export interface CheckItem {
  key: string
  unit: Unit
  source: CheckSource
  prompt: string
  answer: string | null
  /** The linked exam question asked for a chapter (it gets its own review too). */
  question: Unit | null
  card: Card | null
}

export function checkItems(
  units: Unit[],
  cards: Card[],
  questionsOf: (unit: Unit) => Unit[],
  today: LocalDate,
): CheckItem[] {
  const out: CheckItem[] = []
  for (const unit of units) {
    if (unit.archived_at !== null) continue
    if (unit.kind === 'question') {
      out.push({
        key: `u:${unit.id}`,
        unit,
        source: 'question',
        prompt: unit.title,
        answer: unit.answer?.trim() || null,
        question: null,
        card: null,
      })
    } else if (unit.level >= 1) {
      const question = questionsOf(unit).find((q) => q.answer?.trim()) ?? null
      const notes = unit.notes?.trim() || null
      out.push({
        key: `u:${unit.id}`,
        unit,
        source: question ? 'exam_question' : notes ? 'notes' : 'recall',
        prompt: question ? question.title : unit.title,
        answer: question ? question.answer!.trim() : notes,
        question,
        card: null,
      })
    }
    for (const card of cards)
      if (card.unit_id === unit.id && card.next_review_on !== null && card.next_review_on <= today)
        out.push({
          key: `c:${card.id}`,
          unit,
          source: 'card',
          prompt: card.front,
          answer: card.back,
          question: null,
          card,
        })
  }
  return out
}

const LOG_SOURCE: Record<Exclude<CheckSource, 'card'>, RecallSource> = {
  exam_question: 'exam_question',
  notes: 'notes',
  recall: 'blurt',
  question: 'exam_question',
}

/** Ratings → reviews: the unit (and the exam question asked for it) and each card. */
export function checkReviews(
  items: CheckItem[],
  ratings: Record<string, Recall>,
): { units: UnitReview[]; cards: CardReview[] } {
  const units: UnitReview[] = []
  const cards: CardReview[] = []
  const questions = new Set<string>()
  for (const item of items) {
    const recall = ratings[item.key]
    if (recall === undefined) continue
    if (item.card) {
      cards.push({ card: item.card, unit: item.unit, recall })
      continue
    }
    units.push({
      unit: item.unit,
      recalls: [{ recall, source: LOG_SOURCE[item.source as Exclude<CheckSource, 'card'>] }],
    })
    if (
      item.question &&
      !questions.has(item.question.id) &&
      !items.some((x) => x.unit.id === item.question!.id)
    ) {
      questions.add(item.question.id)
      units.push({ unit: item.question, recalls: [{ recall, source: 'exam_question' }] })
    }
  }
  return { units, cards }
}

export interface CheckChange {
  unit: Unit
  before: number | null
  after: number
  relearn: boolean
}

export interface CheckSummary {
  count: number
  remembered: number
  partly: number
  forgot: number
  /** One row per unit (its own outcome, or its cards'). */
  changes: CheckChange[]
  relearn: Unit[]
  /** Days until the nearest next check; null when nothing is scheduled. */
  nextInDays: number | null
}

export function checkSummary(
  items: CheckItem[],
  ratings: Record<string, Recall>,
  outcomes: Outcome[],
  today: LocalDate,
): CheckSummary {
  const rated = items.filter((i) => ratings[i.key] !== undefined)
  const changes: CheckChange[] = []
  const seen = new Set<string>()
  for (const item of rated) {
    if (seen.has(item.unit.id)) continue
    seen.add(item.unit.id)
    const own = outcomes.find((o) => o.kind === 'unit' && o.id === item.unit.id)
    const mine = own
      ? [own]
      : outcomes.filter((o) => o.kind === 'card' && o.unitId === item.unit.id)
    if (mine.length === 0) continue
    const befores = mine.map((o) => o.strengthBefore).filter((x): x is number => x !== null)
    changes.push({
      unit: item.unit,
      before: befores.length ? befores.reduce((s, x) => s + x, 0) / befores.length : null,
      after: mine.reduce((s, o) => s + o.strengthAfter, 0) / mine.length,
      relearn: mine.some((o) => o.relearn),
    })
  }
  const next = outcomes
    .map((o) => o.nextReviewOn)
    .filter((d): d is string => d !== null)
    .sort()[0]
  return {
    count: rated.length,
    remembered: rated.filter((i) => ratings[i.key] === 2).length,
    partly: rated.filter((i) => ratings[i.key] === 1).length,
    forgot: rated.filter((i) => ratings[i.key] === 0).length,
    changes,
    relearn: changes.filter((c) => c.relearn).map((c) => c.unit),
    nextInDays: next ? diffDays(today, next) : null,
  }
}
