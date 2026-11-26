import { blendedRate } from '.'
import type { LearnedRate } from './calibration'

/**
 * Time of a block that studies a unit through its summary (PRD "Sažetak umjesto čitanja",
 * Sprint 18). Before the summary exists: a share of the reading estimate. Once it exists: its
 * length at the user's summary pace, which is learned from sessions with a summary (minutes per
 * 100 words) and blended with the prior by the same shrinkage as the reading pace.
 */

/** Before a summary exists: this share of the reading estimate. */
export const SUMMARY_SHARE = 0.2
export const SUMMARY_MIN_MINUTES = 10
/** Prior pace for studying (not skimming) a summary: dense ideas, formulas, a page reference. */
export const SUMMARY_PRIOR_MIN_PER_100_WORDS = 3

export interface SummarySample {
  minutes: number
  words: number
}

/** Mean minutes per 100 words over sessions that studied a summary. */
export function summaryPace(samples: SummarySample[]): LearnedRate {
  const rates = samples
    .filter((s) => s.minutes > 0 && s.words > 0)
    .map((s) => s.minutes / (s.words / 100))
  if (rates.length === 0) return { rate: null, samples: 0 }
  return { rate: rates.reduce((a, b) => a + b, 0) / rates.length, samples: rates.length }
}

const round5 = (m: number) => Math.round(m / 5) * 5

/**
 * Minutes for a summary block, never above the reading estimate (a summary that would take
 * longer than reading is no saving, so the reading estimate stays).
 */
export function summaryMinutes(
  readingMinutes: number,
  words: number | null,
  pace: LearnedRate,
): number {
  const raw =
    words === null
      ? readingMinutes * SUMMARY_SHARE
      : (words / 100) * blendedRate(SUMMARY_PRIOR_MIN_PER_100_WORDS, pace.rate, pace.samples)
  return Math.min(readingMinutes, Math.max(SUMMARY_MIN_MINUTES, round5(raw)))
}
