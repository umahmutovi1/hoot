import { questionsByChapter, type DirectLink, type TopicLink } from '@/lib/questions/links'
import type { Recall } from '@/lib/srs'
import type { Card, Unit } from '@/features/sources/model'
import type { CardReview, RecallSource, UnitReview } from './apply'

/**
 * Recall gate (PRD "Recall gate", "Testiranje bez sadržaja literature"): after "Pročitano" a
 * chapter is tested with what exists for it. Stage 9 sources: exam questions linked through
 * topics, the unit's notes (without AI), subheadings, blurting and cards. Ratings come after the
 * answer is shown; each item rated here also updates its own memory (questions, cards).
 */

/** One test: a leaf chapter, or a parent whose read leaves are its subheadings. */
export interface GateTarget {
  key: string
  title: string
  label: string | null
  /** Leaves the test rates (FSRS objects). */
  leaves: Unit[]
}

export type GateSource = 'exam_question' | 'notes' | 'outline' | 'card' | 'page_photo' | 'general'

/** Sources the AI writes questions for (recall-questions, Stage 10). */
export type AiSource = 'notes' | 'page_photo' | 'general'

/** AI questions loaded for a test, by source. */
export type AiQuestions = Partial<Record<AiSource, { question: string; answer: string }[]>>

export interface GateItem {
  /** `q:`, `n:`, `c:` + id */
  key: string
  source: GateSource
  prompt: string
  /** Shown after "Prikaži odgovor"; null = no answer saved (exam question). */
  answer: string | null
  /** The exam question or card the item is (its own review), or the leaf for notes. */
  refId: string
  /** Written by the AI (notes, page photo, general knowledge). */
  ai?: boolean
  /** The saved answer of an exam question is an accepted AI proposal ("provjeri"). */
  aiAnswer?: boolean
}

/**
 * Units read in one go, grouped into tests: two or more leaves of the same parent become one test
 * of the parent with its subheadings; the rest are tested one by one. Order follows the list.
 */
export function gateTargets(read: Unit[], all: Unit[]): GateTarget[] {
  const byId = new Map(all.map((u) => [u.id, u]))
  const leavesOf = new Map<string, Unit[]>()
  for (const u of read)
    if (u.parent_id) leavesOf.set(u.parent_id, [...(leavesOf.get(u.parent_id) ?? []), u])
  const out: GateTarget[] = []
  const done = new Set<string>()
  for (const u of read) {
    if (done.has(u.id)) continue
    const siblings = u.parent_id ? (leavesOf.get(u.parent_id) ?? []) : []
    const parent = u.parent_id ? byId.get(u.parent_id) : undefined
    if (parent && siblings.length >= 2) {
      for (const s of siblings) done.add(s.id)
      out.push({ key: parent.id, title: parent.title, label: parent.label, leaves: siblings })
    } else {
      done.add(u.id)
      out.push({ key: u.id, title: u.title, label: u.label, leaves: [u] })
    }
  }
  return out
}

/** Items of each question-type source that exist for a test (empty sources are not offered). */
export function gateItems(
  target: GateTarget,
  questions: Unit[],
  cards: Card[],
  ai: AiQuestions = {},
): Record<Exclude<GateSource, 'outline'>, GateItem[]> {
  const leafIds = new Set(target.leaves.map((l) => l.id))
  const aiItems = (source: AiSource): GateItem[] =>
    (ai[source] ?? []).map((q, i) => ({
      key: `a:${source}:${i}`,
      source,
      prompt: q.question,
      answer: q.answer,
      refId: target.key,
      ai: true,
    }))
  return {
    page_photo: aiItems('page_photo'),
    general: aiItems('general'),
    exam_question: questions.map((q) => ({
      key: `q:${q.id}`,
      source: 'exam_question',
      prompt: q.title,
      answer: q.answer?.trim() || null,
      refId: q.id,
      aiAnswer: q.answer_origin === 'ai',
    })),
    // AI questions from the notes replace the plain "what do you know" item once they are there.
    notes: ai.notes
      ? aiItems('notes')
      : target.leaves
          .filter((l) => l.notes?.trim())
          .map((l) => ({
            key: `n:${l.id}`,
            source: 'notes',
            prompt: l.title,
            answer: l.notes!.trim(),
            refId: l.id,
          })),
    card: cards
      .filter((c) => leafIds.has(c.unit_id))
      .map((c) => ({
        key: `c:${c.id}`,
        source: 'card',
        prompt: c.front,
        answer: c.back,
        refId: c.id,
      })),
  }
}

export interface GateAnswers {
  /** Item key → rating. */
  ratings: Record<string, Recall>
  /** Subheadings: leaf id → could explain it. Only for tests with two or more leaves. */
  explained: Record<string, boolean>
  /** Blurting rating for the whole test. */
  blurt: Recall | null
}

export const EMPTY_ANSWERS: GateAnswers = { ratings: {}, explained: {}, blurt: null }

/** The test has at least one rating. */
export function answered(target: GateTarget, a: GateAnswers): boolean {
  return (
    a.blurt !== null ||
    Object.keys(a.ratings).length > 0 ||
    target.leaves.some((l) => a.explained[l.id] !== undefined)
  )
}

/**
 * Ratings → reviews. Every leaf gets the questions, blurting and (for itself) notes, cards and its
 * subheading; each exam question and card gets its own review too.
 */
export function gateReviews(
  target: GateTarget,
  a: GateAnswers,
  questions: Unit[],
  cards: Card[],
): { units: UnitReview[]; cards: CardReview[] } {
  const shared: UnitReview['recalls'] = []
  for (const q of questions) {
    const r = a.ratings[`q:${q.id}`]
    if (r !== undefined) shared.push({ recall: r, source: 'exam_question' })
  }
  if (a.blurt !== null) shared.push({ recall: a.blurt, source: 'blurt' })
  // AI questions test the whole chapter: every leaf gets them, under their source.
  for (const [key, recall] of Object.entries(a.ratings)) {
    const source = /^a:(notes|page_photo|general):/.exec(key)?.[1] as AiSource | undefined
    if (source) shared.push({ recall, source })
  }

  // Subheadings exist only for a test of two or more leaves; each one is rated by itself.
  const outlineDone =
    target.leaves.length > 1 && target.leaves.some((l) => a.explained[l.id] !== undefined)

  const units: UnitReview[] = []
  for (const leaf of target.leaves) {
    const own: UnitReview['recalls'] = [...shared]
    const notes = a.ratings[`n:${leaf.id}`]
    if (notes !== undefined) own.push({ recall: notes, source: 'notes' })
    for (const c of cards)
      if (c.unit_id === leaf.id && a.ratings[`c:${c.id}`] !== undefined)
        own.push({ recall: a.ratings[`c:${c.id}`]!, source: 'card' })
    if (outlineDone) own.push({ recall: a.explained[leaf.id] ? 2 : 0, source: 'outline' })
    if (own.length > 0) units.push({ unit: leaf, recalls: own })
  }
  for (const q of questions) {
    const r = a.ratings[`q:${q.id}`]
    if (r !== undefined) units.push({ unit: q, recalls: [{ recall: r, source: 'exam_question' }] })
  }
  const leafById = new Map(target.leaves.map((l) => [l.id, l]))
  const cardReviews: CardReview[] = cards.flatMap((c) => {
    const r = a.ratings[`c:${c.id}`]
    const unit = leafById.get(c.unit_id)
    return r !== undefined && unit ? [{ card: c, unit, recall: r }] : []
  })
  return { units, cards: cardReviews }
}

/** Exam questions linked to the test through topics or directly (PRD "Pitanja kao glavni put"). */
export function linkedQuestions(
  target: GateTarget,
  links: TopicLink[],
  units: Unit[],
  direct: DirectLink[] = [],
): Unit[] {
  const byChapter = questionsByChapter(units, links, direct)
  const ids = new Set(target.leaves.flatMap((l) => [...(byChapter.get(l.id) ?? [])]))
  return units
    .filter((u) => u.kind === 'question' && u.archived_at === null && ids.has(u.id))
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
}

export type { RecallSource }

/** Blurting lasts 4 minutes (PRD: 3–5 min). */
export const BLURT_SECONDS = 240

/** "3:42" left of the blurting time. */
export function blurtClock(startedAt: number, now: number): string {
  const left = Math.max(0, BLURT_SECONDS - Math.floor((now - startedAt) / 1000))
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
}
