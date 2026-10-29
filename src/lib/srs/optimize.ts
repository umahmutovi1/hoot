import { diffDays, localDay, type DayBoundary, type LocalDate } from '@/lib/day'
import { ratingOf, type Recall } from '.'

/**
 * Personal FSRS parameters (ROADMAP 11a, RESEARCH-ML 5.3): the FSRS-6 optimizer of
 * `@open-spaced-repetition/binding` (threadless WASI build in a Web Worker) fits the 21 weights
 * to the user's `review_logs` from `MIN_REVIEWS` reviews on, and again as reviews grow. They are
 * used only when their out-of-sample log loss (time-series splits) beats the default weights.
 * The result is stored in `profiles.fsrs_params`; `paramsOf()` reads it for `srs/index.ts` and
 * the plan state (so it is part of `input_hash`).
 */

export const MIN_REVIEWS = 100
/** Refit after this many new reviews, or after `REFIT_DAYS` with any new ones. */
export const REFIT_REVIEWS = 50
export const REFIT_DAYS = 30
export const FSRS6_WEIGHTS = 21

/** `profiles.fsrs_params`. */
export interface FsrsFit {
  version: 1
  /** Personal FSRS-6 weights; null when they did not beat the defaults (or the fit failed). */
  w: number[] | null
  /** Reviews the fit saw. */
  reviews: number
  fittedOn: LocalDate
  /** Out-of-sample log loss of the personal weights, and of the defaults on the same reviews. */
  logLoss: number | null
  defaultLogLoss: number | null
}

export interface ReviewLog {
  /** The card, or the unit for a review of the unit itself. */
  itemId: string
  reviewedAt: string
  recall: Recall
  /** 1–4 when logged (Stage 11a); older rows have only `recall`. */
  rating: number | null
}

export interface TrainReview {
  rating: number
  /** Whole local days since the item's previous review (0 for the first one). */
  deltaT: number
}

/**
 * Training sequences in the optimizer's format: per item, its reviews in order with whole-day
 * gaps (FSRS-6, no short-term memory: only the first review of a local day counts), and one
 * training item per review after the first (the review with the history before it).
 */
export function trainSequences(logs: ReviewLog[], boundary: DayBoundary): TrainReview[][] {
  const byItem = new Map<string, ReviewLog[]>()
  for (const log of logs) byItem.set(log.itemId, [...(byItem.get(log.itemId) ?? []), log])
  const out: TrainReview[][] = []
  for (const id of [...byItem.keys()].sort()) {
    const list = byItem.get(id)!.sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt))
    const seq: TrainReview[] = []
    let last: LocalDate | null = null
    for (const log of list) {
      const day = localDay(new Date(log.reviewedAt), boundary)
      if (day === last) continue
      seq.push({
        rating: log.rating ?? ratingOf(log.recall),
        deltaT: last ? diffDays(last, day) : 0,
      })
      last = day
      if (seq.length >= 2) out.push([...seq])
    }
  }
  return out
}

export function needsFit(fit: FsrsFit | null, reviews: number, today: LocalDate): boolean {
  if (reviews < MIN_REVIEWS) return false
  if (!fit) return true
  return (
    reviews >= fit.reviews + REFIT_REVIEWS ||
    (reviews > fit.reviews && diffDays(fit.fittedOn, today) >= REFIT_DAYS)
  )
}

export interface OptimizerResult {
  w: number[]
  logLoss: number
  defaultLogLoss: number
}

/** The stored fit: personal weights only when they beat the defaults out of sample. */
export function fitOf(result: OptimizerResult | null, reviews: number, today: LocalDate): FsrsFit {
  const valid =
    result !== null &&
    result.w.length === FSRS6_WEIGHTS &&
    result.w.every(Number.isFinite) &&
    Number.isFinite(result.logLoss) &&
    Number.isFinite(result.defaultLogLoss)
  return {
    version: 1,
    w: valid && result.logLoss < result.defaultLogLoss ? result.w : null,
    reviews,
    fittedOn: today,
    logLoss: valid ? result.logLoss : null,
    defaultLogLoss: valid ? result.defaultLogLoss : null,
  }
}

/** A stored fit (`profiles.fsrs_params`, untrusted JSON), or null. */
export function parseFit(raw: unknown): FsrsFit | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Partial<FsrsFit>
  if (f.version !== 1 || typeof f.reviews !== 'number' || typeof f.fittedOn !== 'string')
    return null
  const w =
    Array.isArray(f.w) && f.w.length === FSRS6_WEIGHTS && f.w.every(Number.isFinite) ? f.w : null
  return {
    version: 1,
    w,
    reviews: f.reviews,
    fittedOn: f.fittedOn,
    logLoss: typeof f.logLoss === 'number' ? f.logLoss : null,
    defaultLogLoss: typeof f.defaultLogLoss === 'number' ? f.defaultLogLoss : null,
  }
}

/** Weights for `srs/index.ts`: the personal ones, or undefined for the defaults. */
export function paramsOf(raw: unknown): number[] | undefined {
  return parseFit(raw)?.w ?? undefined
}
