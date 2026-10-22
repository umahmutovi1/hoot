import type { Measure } from '@/lib/outline/parse'

/**
 * Minutes per unit (PRD "Procjena težine i vremena"):
 *   m = amount × rate × mult(d)
 * rate = per-source heuristic blended with the measured rate (shrinkage), d = prior difficulty
 * corrected by the user's ratings on the same source.
 */

export type SourceKind = 'book' | 'script' | 'questions' | 'slides' | 'other'

/** Measure each source kind uses; `other` picks pages or items when the source is added. */
export const DEFAULT_MEASURE: Record<SourceKind, Measure> = {
  book: 'pages',
  script: 'pages',
  questions: 'questions',
  slides: 'slides',
  other: 'pages',
}

/** Starting minutes per page / slide / question; assumptions until calibration takes over. */
export const BASE_MINUTES: Record<Exclude<SourceKind, 'other'>, number> = {
  book: 4,
  script: 6,
  slides: 1.5,
  questions: 8,
}

/** `other` measured in items: the user sets minutes per item when adding the source. */
export const DEFAULT_ITEM_MINUTES = 30

export function baseMinPerUnit(kind: SourceKind, measure: Measure): number {
  if (kind !== 'other') return BASE_MINUTES[kind]
  return measure === 'items' ? DEFAULT_ITEM_MINUTES : BASE_MINUTES.book
}

const MULTIPLIER = [0.6, 0.8, 1.0, 1.3, 1.7] as const
export const DEFAULT_DIFFICULTY = 3

/** 1 → 0.6, 2 → 0.8, 3 → 1.0, 4 → 1.3, 5 → 1.7; corrected (fractional) values interpolate. */
export function difficultyMultiplier(d: number): number {
  const x = Math.min(5, Math.max(1, d)) - 1
  const lo = Math.floor(x)
  const hi = Math.min(4, lo + 1)
  return MULTIPLIER[lo]! + (MULTIPLIER[hi]! - MULTIPLIER[lo]!) * (x - lo)
}

export interface RatedUnit {
  prior: number | null
  user: number
}

/** d_adj − d_prior = n/(n+3) · mean(user − prior), over the source's rated units. */
export function difficultyCorrection(rated: RatedUnit[]): number {
  const n = rated.length
  if (n === 0) return 0
  const mean = rated.reduce((s, r) => s + (r.user - (r.prior ?? DEFAULT_DIFFICULTY)), 0) / n
  return (n / (n + 3)) * mean
}

/** rate = k/(k+5) · measured + 5/(k+5) · heuristic, k = units with recorded time. */
export function blendedRate(base: number, learned: number | null, samples: number): number {
  if (learned === null || samples <= 0) return base
  return (samples / (samples + 5)) * learned + (5 / (samples + 5)) * base
}

export interface EstimateInput {
  id: string
  amount: number
  priorDifficulty: number | null
  userDifficulty: number | null
}

export interface UnitEstimate {
  minutes: number
  difficulty: number
}

/**
 * Estimates every unit of one source. Rated units use the user's own rating; the rest use their
 * prior corrected by how the user's ratings differed from the priors so far.
 */
export function estimateUnits(units: EstimateInput[], rate: number): Map<string, UnitEstimate> {
  const correction = difficultyCorrection(
    units
      .filter((u) => u.userDifficulty !== null)
      .map((u) => ({ prior: u.priorDifficulty, user: u.userDifficulty! })),
  )
  return new Map(
    units.map((u) => {
      const difficulty =
        u.userDifficulty ??
        Math.min(5, Math.max(1, (u.priorDifficulty ?? DEFAULT_DIFFICULTY) + correction))
      return [u.id, { difficulty, minutes: u.amount * rate * difficultyMultiplier(difficulty) }]
    }),
  )
}

/** A source's own measurements for the personal speed factor. */
export interface SpeedSample {
  id: string
  kind: SourceKind
  /** Heuristic minutes per unit of measure the source started from. */
  base: number
  /** Measured minutes per unit of measure (difficulty 3), null before the first sample. */
  learned: number | null
  samples: number
}

/** A source counts towards the speed factor from this many measured units. */
export const SPEED_MIN_SAMPLES = 3

/**
 * Personal speed factor f (PRD "Procjena težine i vremena" → 5): mean of measured / heuristic
 * over sources of the same kind (all kinds as a fallback) with at least 3 samples, shrunk to 1
 * by the number of sources j: f = j/(j+2) · mean + 2/(j+2). `exceptId` leaves the source itself
 * out, so its own measurements are not counted twice.
 */
export function speedFactor(sources: SpeedSample[], kind: SourceKind, exceptId?: string): number {
  const measured = sources.filter(
    (s) => s.id !== exceptId && s.learned !== null && s.samples >= SPEED_MIN_SAMPLES && s.base > 0,
  )
  const same = measured.filter((s) => s.kind === kind)
  const group = same.length > 0 ? same : measured
  const j = group.length
  if (j === 0) return 1
  const mean = group.reduce((sum, s) => sum + s.learned! / s.base, 0) / j
  return (j / (j + 2)) * mean + 2 / (j + 2)
}
