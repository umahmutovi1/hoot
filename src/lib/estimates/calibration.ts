import { blendedRate, difficultyMultiplier } from '.'

/**
 * Calibration from the timer (PRD "Procjena težine i vremena" → 4. Timer, Način učenja, Prije
 * mjerenja). A unit studied in a session gives one rate sample: minutes per unit of measure,
 * normalized by its difficulty so a hard chapter does not slow down the whole source. The source
 * and every source × mode pair keep the mean of their samples; pauses never count.
 */

export type StudyMode = 'reading' | 'problems' | 'review' | 'questions'

/** A pair (source × mode) replaces the source rate only from this many samples. */
export const MODE_MIN_SAMPLES = 3
/** Before this many finished sessions a source shows a suggested duration, not a range. */
export const MEASURED_SESSIONS = 3

export interface RateSample {
  minutes: number
  amountDone: number
  difficulty: number
}

/** Minutes per unit of measure at difficulty 3; null when the sample says nothing. */
export function sampleRate(s: RateSample): number | null {
  if (s.minutes <= 0 || s.amountDone <= 0) return null
  return s.minutes / (s.amountDone * difficultyMultiplier(s.difficulty))
}

export interface LearnedRate {
  /** Mean of the samples, null before the first one. */
  rate: number | null
  samples: number
}

/** Adds samples to a running mean. */
export function addSamples(prev: LearnedRate, samples: RateSample[]): LearnedRate {
  const rates = samples.map(sampleRate).filter((r): r is number => r !== null)
  if (rates.length === 0) return prev
  const k = prev.rate === null ? 0 : prev.samples
  const sum = (prev.rate ?? 0) * k + rates.reduce((s, r) => s + r, 0)
  return { rate: sum / (k + rates.length), samples: k + rates.length }
}

/**
 * Minutes per unit of measure for a block in `mode`: the pair's own rate once it has 3 samples,
 * otherwise the source rate for every mode; both blended with the heuristic by shrinkage.
 */
export function rateForMode(base: number, source: LearnedRate, pair: LearnedRate | null): number {
  if (pair && pair.rate !== null && pair.samples >= MODE_MIN_SAMPLES)
    return blendedRate(base, pair.rate, pair.samples)
  return blendedRate(base, source.rate, source.samples)
}

/** First pass or review is read from the unit's level, not picked (PRD "Prije mjerenja"). */
export function defaultMode(level: number, isQuestion: boolean): StudyMode {
  if (isQuestion) return 'questions'
  return level === 0 ? 'reading' : 'review'
}

export function isMeasured(finishedSessions: number): boolean {
  return finishedSessions >= MEASURED_SESSIONS
}
