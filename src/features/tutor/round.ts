import type { CheckItem } from '@/features/review/check'
import type { Card, Unit } from '@/features/sources/model'
import type { LocalDate } from '@/lib/day'

/**
 * A round of "Ispitaj me" / "Usmeni" (PRD "AI tutor"): the same questions as the recall gate
 * (exam questions linked to the chapter, its cards with the due ones first), filled up with
 * questions the tutor writes from the source text. Ratings go through `checkReviews()` →
 * `planReviews()`, so they land in `review_logs` and `levelAfter()` like a knowledge check.
 */

export const ROUND_SIZE = 6

export interface TextQuestion {
  question: string
  answer: string
  page: number | null
}

/** The FSRS object a page belongs to: the leaf whose page range holds it, else the first leaf. */
export function leafOfPage(leaves: Unit[], page: number | null): Unit {
  if (page !== null)
    for (const l of leaves)
      if (
        l.page_start !== null &&
        l.page_end !== null &&
        page >= l.page_start &&
        page <= l.page_end
      )
        return l
  return leaves[0]!
}

/** Items from what exists for the chapter, at most `ROUND_SIZE`. */
export function roundItems(
  leaves: Unit[],
  questions: Unit[],
  cards: Card[],
  today: LocalDate,
): CheckItem[] {
  if (leaves.length === 0) return []
  const leafIds = new Set(leaves.map((l) => l.id))
  const out: CheckItem[] = []
  for (const q of questions)
    out.push({
      key: `q:${q.id}`,
      unit: leaves[0]!,
      source: 'exam_question',
      prompt: q.title,
      answer: q.answer?.trim() || null,
      question: q,
      card: null,
    })
  const due = (c: Card) => c.next_review_on !== null && c.next_review_on <= today
  const own = cards
    .filter((c) => leafIds.has(c.unit_id))
    .sort(
      (a, b) =>
        Number(due(b)) - Number(due(a)) ||
        (a.next_review_on ?? '9999').localeCompare(b.next_review_on ?? '9999') ||
        a.id.localeCompare(b.id),
    )
  for (const c of own)
    out.push({
      key: `c:${c.id}`,
      unit: leaves.find((l) => l.id === c.unit_id)!,
      source: 'card',
      prompt: c.front,
      answer: c.back,
      question: null,
      card: c,
    })
  return out.slice(0, ROUND_SIZE)
}

/** How many questions the tutor should write from the text to fill the round. */
export function missing(items: CheckItem[], hasText: boolean): number {
  return hasText ? Math.max(0, ROUND_SIZE - items.length) : 0
}

/** The tutor's questions as items rated like the rest (`source_text` in `review_logs`). */
export function textItems(leaves: Unit[], questions: TextQuestion[]): CheckItem[] {
  return questions.map((q, i) => ({
    key: `t:${i}:${q.question}`,
    unit: leafOfPage(leaves, q.page),
    source: 'source_text',
    prompt: q.question,
    answer: q.answer,
    question: null,
    card: null,
  }))
}
