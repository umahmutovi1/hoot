import {
  default_w,
  forgetting_curve,
  fsrs,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs'
import { addDays, diffDays, type LocalDate } from '@/lib/day'
import { priorityRule } from '@/lib/scheduler/constants'

/**
 * Spaced repetition (PRD "Spaced repetition (FSRS)") on top of `ts-fsrs` (FSRS v6, default
 * parameters until personal ones exist). Every unit (chapter or exam question) and every card in
 * review has a memory state; strength R is the probability of recall on a given day and is
 * computed from it, never stored. Days are local days (`src/lib/day.ts`): a review at 01:30
 * belongs to the previous day, so intervals are whole days between local dates.
 */

/** Self-rated recall after seeing the answer: 0 "Ne", 1 "Djelimično", 2 "Sjećam se". */
export type Recall = 0 | 1 | 2

/** What is being reviewed: chapters get a higher target (they are not short cards). */
export type ItemKind = 'chapter' | 'question' | 'card'

/** Memory state as stored on `units` / `cards` (`fsrs_*`, `last_review_at`, `review_streak`). */
export interface Memory {
  stability: number
  difficulty: number
  /** ts-fsrs State: 0 new, 1 learning, 2 review, 3 relearning. */
  state: number
  reps: number
  lapses: number
  /** Local day of the last review. */
  lastReviewOn: LocalDate
  /** Successful reviews ("Sjećam se") in a row since the last miss. */
  streak: number
}

/** Days after "Pročitano" without a recall gate until the check of what was read. */
export const READ_CHECK_DAYS = 2

/** Successful reviews in a row that make a chapter "Ponovljeno" (level 3). */
export const REPEATED_AFTER = 4

/** Chapters aim this much higher than the priority table, but never above `MAX_RETENTION`. */
export const CHAPTER_RETENTION_BONUS = 0.03
export const MAX_RETENTION = 0.93

/** UI scale: 85%+ Jako, 75–84 Dobro, 60–74 Slabi, below 60 Zaboravlja se. */
export type StrengthBand = 'strong' | 'good' | 'weak' | 'fading'

export function strengthBand(r: number): StrengthBand {
  const pct = Math.round(r * 100)
  if (pct >= 85) return 'strong'
  if (pct >= 75) return 'good'
  if (pct >= 60) return 'weak'
  return 'fading'
}

export function ratingOf(recall: Recall): Grade {
  return recall === 2 ? Rating.Good : recall === 1 ? Rating.Hard : Rating.Again
}

/** Target retention by the subject's priority; chapters +0.03 (at most 0.93). */
export function targetRetention(priority: number, kind: ItemKind): number {
  const base = priorityRule(priority).retention
  if (kind !== 'chapter') return base
  return Math.min(MAX_RETENTION, Math.round((base + CHAPTER_RETENTION_BONUS) * 1000) / 1000)
}

/** Strength on a local day; 1 on the day of the review and falling after it. */
export function retrievabilityOn(
  memory: Pick<Memory, 'stability' | 'lastReviewOn'>,
  date: LocalDate,
  params: readonly number[] = default_w,
): number {
  const elapsed = Math.max(0, diffDays(memory.lastReviewOn, date))
  if (memory.stability <= 0) return 0
  return forgetting_curve(params, elapsed, memory.stability)
}

export interface ReviewInput {
  /** null = the first test (recall gate or the check of what was read). */
  memory: Memory | null
  recall: Recall
  /** Local day of the review. */
  today: LocalDate
  retention: number
  /**
   * Last day a review may fall on before the unit's nearest exam (first buffer day, or the day
   * before the exam); null without an upcoming exam.
   */
  lastDay: LocalDate | null
  params?: readonly number[]
}

export interface ReviewResult {
  memory: Memory
  nextReviewOn: LocalDate
  /** Days since the previous review (0 for the first one). */
  elapsedDays: number
  stabilityBefore: number | null
  stabilityAfter: number
  /** Strength just before this review; null for the first one. */
  retrievabilityBefore: number | null
}

/** Noon UTC of a local day: whole-day differences in ts-fsrs equal local-day differences. */
const noonOf = (date: LocalDate) => new Date(`${date}T12:00:00Z`)

const schedulers = new Map<string, ReturnType<typeof fsrs>>()
function schedulerFor(retention: number, params: readonly number[]) {
  const key = `${retention}|${params.join(',')}`
  let f = schedulers.get(key)
  if (!f) {
    // Days, not minutes: no (re)learning steps, no fuzz (the plan must be deterministic).
    f = fsrs({
      request_retention: retention,
      w: params,
      enable_fuzz: false,
      enable_short_term: false,
    })
    schedulers.set(key, f)
  }
  return f
}

function toCard(memory: Memory | null, today: LocalDate): FsrsCard {
  const now = noonOf(today)
  if (!memory)
    return {
      due: now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: State.New,
    }
  return {
    due: now,
    stability: memory.stability,
    difficulty: memory.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: memory.reps,
    lapses: memory.lapses,
    state: memory.state as State,
    last_review: noonOf(memory.lastReviewOn),
  }
}

/**
 * Clamps a review date to the last day before the exam (PRD: "Datum ponavljanja nikad ne prelazi
 * ispit"); a review never falls on the day of the test or earlier.
 */
export function clampReviewOn(
  due: LocalDate,
  today: LocalDate,
  lastDay: LocalDate | null,
): LocalDate {
  const tomorrow = addDays(today, 1)
  if (lastDay !== null && lastDay >= tomorrow && due > lastDay) return lastDay
  return due < tomorrow ? tomorrow : due
}

/** One review: recall 0/1/2 → Again/Hard/Good, new memory state and the next review day. */
export function review(input: ReviewInput): ReviewResult {
  const params = input.params ?? default_w
  const f = schedulerFor(input.retention, params)
  const card = toCard(input.memory, input.today)
  const elapsedDays = input.memory
    ? Math.max(0, diffDays(input.memory.lastReviewOn, input.today))
    : 0
  const retrievabilityBefore = input.memory
    ? retrievabilityOn(input.memory, input.today, params)
    : null
  const next = f.next(card, noonOf(input.today), ratingOf(input.recall)).card
  const interval = Math.max(1, Math.round(next.scheduled_days))
  return {
    memory: {
      stability: next.stability,
      difficulty: next.difficulty,
      state: next.state,
      reps: next.reps,
      lapses: next.lapses,
      lastReviewOn: input.today,
      streak: input.recall === 2 ? (input.memory?.streak ?? 0) + 1 : 0,
    },
    nextReviewOn: clampReviewOn(addDays(input.today, interval), input.today, input.lastDay),
    elapsedDays,
    stabilityBefore: input.memory ? input.memory.stability : null,
    stabilityAfter: next.stability,
    retrievabilityBefore,
  }
}

/**
 * Level after a review (PRD "Ishod"). Chapters: "Sjećam se" → at least 2 ("Razumijem"), and 3
 * ("Ponovljeno") after `REPEATED_AFTER` successes in a row; "Ne" on level 2+ → 1 (back to
 * learning). Questions use 0, 1, 3: "Sjećam se" → 3 ("Znam"), "Djelimično" → 1, "Ne" on a known
 * one → 1. Anything else keeps the level.
 */
export function levelAfter(
  kind: 'chapter' | 'question',
  level: number,
  recall: Recall,
  streak: number,
): number {
  if (kind === 'question') {
    if (recall === 2) return 3
    if (recall === 1) return 1
    return level >= 1 ? 1 : 0
  }
  if (recall === 2) return streak >= REPEATED_AFTER ? 3 : Math.max(level, 2)
  if (recall === 0 && level >= 2) return 1
  return level
}

/**
 * Recall of a chapter from several test items (questions, cards, outline): the mean rounded to
 * 0/1/2 (≥ 1.5 → 2, ≥ 0.5 → 1).
 */
export function combineRecall(recalls: Recall[]): Recall | null {
  if (recalls.length === 0) return null
  const mean = recalls.reduce<number>((s, r) => s + r, 0) / recalls.length
  return mean >= 1.5 ? 2 : mean >= 0.5 ? 1 : 0
}

/** Outline recall: share of subheadings the user could explain (≥ 80% → 2, ≥ 40% → 1). */
export function outlineRecall(explained: number, total: number): Recall {
  if (total <= 0) return 0
  const share = explained / total
  return share >= 0.8 ? 2 : share >= 0.4 ? 1 : 0
}

/**
 * Strength of a unit with its cards: the cards together weigh as one more unit (PRD "jačina
 * jedinice uključuje i njene kartice"). null when neither is in review.
 */
export function unitStrength(unitR: number | null, cardRs: number[]): number | null {
  const parts: number[] = []
  if (unitR !== null) parts.push(unitR)
  if (cardRs.length > 0) parts.push(cardRs.reduce((s, r) => s + r, 0) / cardRs.length)
  if (parts.length === 0) return null
  return parts.reduce((s, r) => s + r, 0) / parts.length
}

export interface StrengthItem {
  minutes: number
  /** Strength of the unit; null = not in review yet (left out). */
  strength: number | null
}

/**
 * Strength of a topic, source, subject or exam: mean R weighted by the units' minutes, over the
 * units in review only (PRD "Jačina na ekranima"). null when none is in review.
 */
export function weightedStrength(items: StrengthItem[]): number | null {
  let w = 0
  let sum = 0
  for (const i of items) {
    if (i.strength === null) continue
    const m = Math.max(1, i.minutes)
    w += m
    sum += m * i.strength
  }
  return w > 0 ? sum / w : null
}
