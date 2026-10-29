import { diffDays, type LocalDate } from '@/lib/day'
import type { BlockKind } from '@/lib/scheduler/types'
import { SLOT_PARTS, type SlotPart } from '@/lib/schedule/rhythm'
import priorsJson from './priors.json'

/**
 * Block completion model (RESEARCH-ML 5.2, PRD "Termini učenja" → Odrađenost kao model):
 *
 *   P(done) = σ(xᵀβ + u_subject),   β ~ N(m, diag(s²)),   u_subject ~ N(0, τ²)
 *
 * x holds the part of the day (one coefficient per part, the intercept carries the mean),
 * weekend, block kind (learn is the reference), placement demand, day load, closeness of the
 * goal, a late previous block and the day's energy (Stage 11b; 0 until it exists). The subject
 * intercept is the hierarchical effect behind the "Izbjegavanje" insight: shrunk to 0 until
 * the subject has blocks, and kept apart from a bad slot or an overloaded day because those
 * have their own coefficients.
 *
 * The prior comes from `ml/` (`priors.json`, its `version` goes into `input_hash`); the
 * personal posterior is a Laplace approximation around the MAP (Newton), small enough
 * (16 + subjects dimensions) to run in the browser on every plan. Labels (RESEARCH-ML 1.2):
 * done = 1, skipped = 0, unconfirmed = 0 with a lower weight; older blocks weigh less
 * (half-life, PRD "Zamke").
 */

export const FEATURES = [
  'intercept',
  ...SLOT_PARTS,
  'weekend',
  'review',
  'questions',
  'recap',
  'deadline',
  'demand',
  'load',
  'goal',
  'prevLate',
  'energy',
] as const
export type Feature = (typeof FEATURES)[number]

export interface CompletionPriors {
  version: number
  mean: Record<Feature, number>
  sd: Record<Feature, number>
  tauSubject: number
  /** Prior shift of the onboarding "kad ti je najlakše učiti" parts (logit). */
  preferredShift: number
  unconfirmedWeight: number
  halfLifeDays: number
  /** Day load up to this is free; every hour above it is one unit of `load`. */
  loadFreeMin: number
  /** Goals further away (or none) count as this far. */
  goalDaysMax: number
}

export const COMPLETION_PRIORS: CompletionPriors = priorsJson

/** What the model sees of one block, at plan time. */
export interface BlockFeatures {
  part: SlotPart
  weekend: boolean
  kind: BlockKind
  demand: number
  dayLoadMin: number
  daysToGoal: number | null
  prevLate: boolean
  /** Stage 11b ("energija dana"); null until then. */
  dayEnergy?: number | null
}

export type CompletionLabel = 'done' | 'skipped' | 'unconfirmed'

export interface CompletionExample extends BlockFeatures {
  subjectId: string
  onDate: LocalDate
  label: CompletionLabel
}

export interface CompletionPosterior {
  version: number
  /** Subjects with their own intercept, after the fixed effects in `mean`/`cov`. */
  subjects: string[]
  mean: number[]
  /** Laplace covariance (inverse Hessian at the MAP). */
  cov: number[][]
  /** Posterior sd of each subject intercept given the fixed effects (1 / √H_ss, lme4's condVar). */
  subjectSd: number[]
  /** Labelled examples behind it (weighted count per subject in `subjectWeight`). */
  n: number
  subjectWeight: Record<string, number>
}

export function featureVector(b: BlockFeatures, p: CompletionPriors = COMPLETION_PRIORS) {
  const x = new Array<number>(FEATURES.length).fill(0)
  const set = (f: Feature, v: number) => (x[FEATURES.indexOf(f)] = v)
  set('intercept', 1)
  set(b.part, 1)
  if (b.weekend) set('weekend', 1)
  if (b.kind !== 'learn') set(b.kind, 1)
  set('demand', b.demand - 1)
  set('load', Math.max(0, b.dayLoadMin - p.loadFreeMin) / 60)
  const days = Math.min(Math.max(0, b.daysToGoal ?? p.goalDaysMax), p.goalDaysMax)
  set('goal', 1 - Math.log1p(days) / Math.log1p(p.goalDaysMax))
  if (b.prevLate) set('prevLate', 1)
  set('energy', b.dayEnergy ?? 0)
  return x
}

/** Prior mean of the fixed effects; preferred parts start higher (PRD: Beta(4, 1) vs (2, 2)). */
export function priorMean(preferred: readonly SlotPart[], p: CompletionPriors = COMPLETION_PRIORS) {
  return FEATURES.map(
    (f) =>
      p.mean[f] +
      ((SLOT_PARTS as readonly string[]).includes(f) && preferred.includes(f as SlotPart)
        ? p.preferredShift
        : 0),
  )
}

export function exampleWeight(
  e: Pick<CompletionExample, 'label' | 'onDate'>,
  today: LocalDate,
  p: CompletionPriors = COMPLETION_PRIORS,
): number {
  const age = Math.max(0, diffDays(e.onDate, today))
  return (e.label === 'unconfirmed' ? p.unconfirmedWeight : 1) * 0.5 ** (age / p.halfLifeDays)
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

/** Cholesky factor of a symmetric positive definite matrix (lower). */
function cholesky(a: number[][]): number[][] {
  const n = a.length
  const l = a.map(() => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = a[i]![j]!
      for (let k = 0; k < j; k++) s -= l[i]![k]! * l[j]![k]!
      l[i]![j] = i === j ? Math.sqrt(s) : s / l[j]![j]!
    }
  return l
}

function solve(l: number[][], b: number[]): number[] {
  const n = b.length
  const y = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = b[i]!
    for (let k = 0; k < i; k++) s -= l[i]![k]! * y[k]!
    y[i] = s / l[i]![i]!
  }
  const x = new Array<number>(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]!
    for (let k = i + 1; k < n; k++) s -= l[k]![i]! * x[k]!
    x[i] = s / l[i]![i]!
  }
  return x
}

function inverse(l: number[][]): number[][] {
  const n = l.length
  const cols = Array.from({ length: n }, (_, j) =>
    solve(
      l,
      Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)),
    ),
  )
  return cols[0] ? cols.map((_, i) => cols.map((c) => c[i]!)) : []
}

const NEWTON_MAX = 50
const NEWTON_TOL = 1e-10

/**
 * Personal posterior: MAP by Newton's method (the log posterior is concave), covariance from the
 * Hessian there. Without examples it is the prior.
 */
export function fitCompletion(
  examples: CompletionExample[],
  today: LocalDate,
  preferred: readonly SlotPart[] = [],
  p: CompletionPriors = COMPLETION_PRIORS,
): CompletionPosterior {
  const subjects = [...new Set(examples.map((e) => e.subjectId))].sort()
  const nf = FEATURES.length
  const dim = nf + subjects.length
  const m = [...priorMean(preferred, p), ...subjects.map(() => 0)]
  const precision = [
    ...FEATURES.map((f) => 1 / p.sd[f] ** 2),
    ...subjects.map(() => 1 / p.tauSubject ** 2),
  ]
  const index = new Map(subjects.map((s, i) => [s, nf + i] as const))
  const rows = examples.map((e) => ({
    x: featureVector(e, p),
    s: index.get(e.subjectId)!,
    y: e.label === 'done' ? 1 : 0,
    w: exampleWeight(e, today, p),
  }))
  const subjectWeight: Record<string, number> = {}
  for (const e of examples)
    subjectWeight[e.subjectId] = (subjectWeight[e.subjectId] ?? 0) + exampleWeight(e, today, p)

  const theta = [...m]
  let l: number[][] = []
  let h: number[][] = []
  for (let iter = 0; iter < NEWTON_MAX; iter++) {
    const g = theta.map((t, i) => precision[i]! * (t - m[i]!))
    h = Array.from({ length: dim }, (_, i) =>
      Array.from({ length: dim }, (_, j) => (i === j ? precision[i]! : 0)),
    )
    for (const r of rows) {
      let z = theta[r.s]!
      for (let i = 0; i < nf; i++) z += r.x[i]! * theta[i]!
      const q = sigmoid(z)
      const c = r.w * (q - r.y)
      const v = r.w * q * (1 - q)
      for (let i = 0; i < nf; i++) {
        if (r.x[i] === 0) continue
        g[i]! += c * r.x[i]!
        for (let j = 0; j < nf; j++) if (r.x[j] !== 0) h[i]![j]! += v * r.x[i]! * r.x[j]!
        h[i]![r.s]! += v * r.x[i]!
        h[r.s]![i]! += v * r.x[i]!
      }
      g[r.s]! += c
      h[r.s]![r.s]! += v
    }
    l = cholesky(h)
    const step = solve(l, g)
    let size = 0
    for (let i = 0; i < dim; i++) {
      theta[i]! -= step[i]!
      size = Math.max(size, Math.abs(step[i]!))
    }
    if (size < NEWTON_TOL) break
  }
  return {
    version: p.version,
    subjects,
    mean: theta,
    cov: inverse(l),
    subjectSd: subjects.map((_, j) => 1 / Math.sqrt(h[nf + j]![nf + j]!)),
    n: examples.length,
    subjectWeight,
  }
}

/** Linear predictor of a block: mean and variance under the posterior. */
export function logitOf(post: CompletionPosterior, b: BlockFeatures, subjectId?: string | null) {
  const x = featureVector(b)
  const j = subjectId ? post.subjects.indexOf(subjectId) : -1
  const idx = x.map((v, i) => [i, v] as const).filter(([, v]) => v !== 0)
  if (j >= 0) idx.push([FEATURES.length + j, 1])
  let mean = 0
  let variance = 0
  for (const [i, v] of idx) {
    mean += v * post.mean[i]!
    for (const [k, w] of idx) variance += v * w * post.cov[i]![k]!
  }
  return { mean, variance }
}

/**
 * P(done) of a block, averaged over the posterior (probit approximation of the logistic-normal
 * integral). A subject without blocks, or none given, counts with effect 0.
 */
export function completionProbability(
  post: CompletionPosterior,
  b: BlockFeatures,
  subjectId?: string | null,
): number {
  const { mean, variance } = logitOf(post, b, subjectId)
  return sigmoid(mean / Math.sqrt(1 + (Math.PI * variance) / 8))
}

export interface SubjectEffect {
  subjectId: string
  /** Logit shift of the subject's blocks (negative = done less often than its slots explain). */
  mean: number
  /**
   * Given the fixed effects: the overall level and the subject mean are split only by the prior,
   * so the marginal sd never drops below ~τ/√subjects; the comparison with the other subjects is
   * what the data measure.
   */
  sd: number
  /** Weighted examples behind it. */
  weight: number
}

/** Subject intercepts with their uncertainty: the input of "Izbjegavanje" (Stage 11). */
export function subjectEffects(post: CompletionPosterior): SubjectEffect[] {
  return post.subjects.map((subjectId, j) => {
    return {
      subjectId,
      mean: post.mean[FEATURES.length + j]!,
      sd: post.subjectSd[j]!,
      weight: post.subjectWeight[subjectId] ?? 0,
    }
  })
}

/** One draw of the fixed effects (Thompson sampling); `normal` gives standard normal numbers. */
export function sampleFixed(post: CompletionPosterior, normal: () => number): CompletionPosterior {
  const nf = FEATURES.length
  const cov = post.cov.slice(0, nf).map((r) => r.slice(0, nf))
  const l = cholesky(cov)
  const z = Array.from({ length: nf }, normal)
  const mean = post.mean.map((v, i) =>
    i < nf ? v + l[i]!.reduce((s, lik, k) => s + lik * z[k]!, 0) : v,
  )
  return { ...post, mean, cov: post.cov.map((r) => r.map(() => 0)) }
}

/** Days between a block and its goal as the features want them (null without a goal). */
export const daysToGoalOf = (onDate: LocalDate, goalOn: LocalDate | null) =>
  goalOn === null ? null : diffDays(onDate, goalOn)
