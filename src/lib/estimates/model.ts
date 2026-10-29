import priorsJson from './priors.json'

/**
 * Duration model (RESEARCH-ML 5.1, ROADMAP 11a): hierarchical log-normal minutes per unit of
 * measure, at difficulty 3 (difficulty stays the multiplier table of `estimateUnits()`):
 *
 *   log rate = μ + t_source + ε,   t_source = b_user + b_source,   ε ~ N(0, σ²)
 *   b_user ~ N(0, τ_user²),  b_source ~ N(0, τ_source²)
 *
 * μ makes the source's heuristic base the mean rate (exp(μ + σ²/2) = base), so a source without
 * measurements keeps today's estimate. Updates are closed-form Normal–Normal, so the personal
 * posterior runs in the browser; `ml/` only fits σ and the τ's (`priors.json`, its `version`
 * goes into `input_hash`). A number the user or a document gave (`units.est_minutes`) is the
 * source's prior instead of the user effect, corrected by the user's own optimism.
 */

export interface DurationPriors {
  version: number
  sigma: number
  tauSource: number
  tauUser: number
  /** Spread of a given number around the truth (before the optimism correction). */
  tauGiven: number
  /** Shrinkage of the optimism factor by the number of sources with both a given and a measure. */
  optimismShrink: number
  /** Shrinkage of the difficulty correction (`difficultyCorrection()`: n/(n + 3)). */
  difficultyShrink: number
  /** Normal quantile of the 80% bound. */
  z80: number
}

export const DURATION_PRIORS: DurationPriors = priorsJson

/** What the model knows about one source (all rates in minutes per unit of measure, d = 3). */
export interface SourceStats {
  id: string
  kind: string
  /** Heuristic base (already scaled by nothing: the user effect is learned here). */
  base: number
  /** Mean measured rate, null before the first sample. */
  learned: number | null
  samples: number
  /** Rate implied by numbers the user or a document gave, null without any. */
  given: number | null
}

export interface Normal {
  mean: number
  variance: number
}

export interface RateEstimate {
  /** Expected minutes per unit of measure: what the plan uses (every priority; P80 for 4–5 was
   * dropped after the simulator: +11% deficit for +1.6% exam score, decision 29 Oct 2026). */
  mean: number
  /** Median of one unit's time. */
  p50: number
  /** 80% upper bound on the expected rate (uncertainty about the source only, so it shrinks as
   * measurements come in); for the forecast, not the plan. */
  p80: number
  /** 80% bound on one unit's time (also the noise of a single session): what P80 coverage is
   * measured against. */
  unitP80: number
  /** Posterior variance of t_source (log scale). */
  variance: number
}

/** A source counts towards the user effect from this many samples (as the old speed factor). */
export const USER_MIN_SAMPLES = 3

const muOf = (base: number, p: DurationPriors) => Math.log(base) - (p.sigma * p.sigma) / 2

/**
 * The mean of log rates from the mean of n measured rates (the app keeps the arithmetic mean):
 * log-normal E[log] = log E − σ²/2, and the log of a sample mean of n sits lower by about
 * (e^σ² − 1) / 2n (delta method), which matters for the first few samples. n = ∞ for a given
 * number, which is a mean already.
 */
const logMeasured = (mean: number, p: DurationPriors, n = Infinity) =>
  Math.log(mean) - (p.sigma * p.sigma) / 2 + (Math.exp(p.sigma * p.sigma) - 1) / (2 * n)

function update(prior: Normal, residual: number, n: number, p: DurationPriors): Normal {
  if (n <= 0) return prior
  const precision = 1 / prior.variance + n / (p.sigma * p.sigma)
  const mean = (prior.mean / prior.variance + (n * residual) / (p.sigma * p.sigma)) / precision
  return { mean, variance: 1 / precision }
}

/**
 * The user's speed effect from their other measured sources of the same kind (all kinds as a
 * fallback), each a noisy look at b_user with variance τ_source² + σ²/n.
 */
export function userEffect(
  sources: SourceStats[],
  kind: string,
  exceptId?: string,
  p: DurationPriors = DURATION_PRIORS,
): Normal {
  const measured = sources.filter(
    (s) => s.id !== exceptId && s.learned !== null && s.samples >= USER_MIN_SAMPLES && s.base > 0,
  )
  const same = measured.filter((s) => s.kind === kind)
  const group = same.length > 0 ? same : measured
  let precision = 1 / (p.tauUser * p.tauUser)
  let weighted = 0
  for (const s of group) {
    const v = p.tauSource * p.tauSource + (p.sigma * p.sigma) / s.samples
    precision += 1 / v
    weighted += (logMeasured(s.learned!, p, s.samples) - muOf(s.base, p)) / v
  }
  return { mean: weighted / precision, variance: 1 / precision }
}

/**
 * Optimism: how measured rates compare to given ones over the user's other sources that have
 * both (log ratio, shrunk to 0 by the number of such sources).
 */
export function optimism(
  sources: SourceStats[],
  exceptId?: string,
  p: DurationPriors = DURATION_PRIORS,
): number {
  const both = sources.filter(
    (s) => s.id !== exceptId && s.given !== null && s.learned !== null && s.samples > 0,
  )
  const j = both.length
  if (j === 0) return 0
  const mean = both.reduce((sum, s) => sum + Math.log(s.learned! / s.given!), 0) / j
  return (j / (j + p.optimismShrink)) * mean
}

/** Posterior of the source's total effect t = b_user + b_source. */
export function sourceEffect(
  source: SourceStats,
  all: SourceStats[],
  p: DurationPriors = DURATION_PRIORS,
): Normal {
  const mu = muOf(source.base, p)
  const prior: Normal =
    source.given !== null && source.given > 0
      ? {
          mean: logMeasured(source.given, p) + optimism(all, source.id, p) - mu,
          variance: p.tauGiven * p.tauGiven,
        }
      : (() => {
          const user = userEffect(all, source.kind, source.id, p)
          return { mean: user.mean, variance: user.variance + p.tauSource * p.tauSource }
        })()
  if (source.learned === null || source.samples <= 0) return prior
  return update(prior, logMeasured(source.learned, p, source.samples) - mu, source.samples, p)
}

export function sourceRate(
  source: SourceStats,
  all: SourceStats[] = [],
  p: DurationPriors = DURATION_PRIORS,
): RateEstimate {
  const t = sourceEffect(source, all, p)
  const m = muOf(source.base, p) + t.mean
  const half = (p.sigma * p.sigma) / 2
  return {
    mean: Math.exp(m + half),
    p50: Math.exp(m),
    p80: Math.exp(m + half + p.z80 * Math.sqrt(t.variance)),
    unitP80: Math.exp(m + p.z80 * Math.sqrt(t.variance + p.sigma * p.sigma)),
    variance: t.variance,
  }
}
