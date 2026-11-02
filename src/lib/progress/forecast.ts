import { addDays, weekdayOf, type LocalDate } from '@/lib/day'
import { seededRandom } from '@/lib/scheduler/hash'
import {
  completionProbability,
  sampleFixed,
  type BlockFeatures,
  type CompletionPosterior,
} from '@/lib/slots/completion'
import { normalFrom } from '@/lib/slots/score'

/**
 * Readiness forecast (PRD "Prognoza spremnosti", Sprint 17): a range and a probability, not one
 * number. Monte Carlo over the saved plan, seeded from `input_hash`:
 *
 * 1. Each day until the last exam gets the minutes the user really studies. With the completion
 *    model (Sprint 15, enough labelled blocks) every planned block is done or not by its
 *    P(done) under one posterior draw per run; before that, a bootstrap of the last 28 days'
 *    studied minutes (weekday / weekend); before 7 such days, capacity × ρ with ±30% noise.
 * 2. Those minutes take the planned work in plan order (what a replan would do with missed
 *    work), slower or faster by one draw of the duration model per run.
 * 3. Per exam: coverage of the scope by its date (10th–90th percentile), P(required work done)
 *    and the expected score share (coverage × memory on the exam day) for the grade estimate.
 */

export interface ForecastBlock {
  onDate: LocalDate
  minutes: number
  subjectId: string
  goalId: string | null
  /** Learning adds coverage; reviews and questions only take time. */
  learn: boolean
  /** What the completion model sees of it. */
  features: BlockFeatures
}

export interface ForecastGoal {
  id: string
  /** Exam day: work counts when it is done before it. */
  on: LocalDate
  scopeMinutes: number
  /** Already covered (progress of the scope). */
  coveredMinutes: number
  /** Required coverage of the subject's priority / target grade, in minutes. */
  requiredMinutes: number
  /** Mean retrievability of the scope on the exam day (0–1), for the score. */
  recallOnExam: number
}

export interface ForecastInput {
  today: LocalDate
  blocks: ForecastBlock[]
  goals: ForecastGoal[]
  completion: CompletionPosterior | null
  /** Studied minutes per past day (any session), for the bootstrap. */
  history: { date: LocalDate; minutes: number }[]
  /** AI capacity per day (after ρ in the plan) for the fallback. */
  capacity: Record<LocalDate, number>
  /** Log-scale sd of the speed (duration model posterior); 0 = estimates are exact. */
  speedSd: number
  seed: number
  runs?: number
}

export type ForecastMethod = 'model' | 'bootstrap' | 'capacity'

export interface Range {
  p10: number
  p50: number
  p90: number
}

export interface GoalForecast {
  goalId: string
  /** Share of the scope covered by the exam day. */
  coverage: Range
  /** P(required coverage reached by the exam day). */
  pRequired: number
  /** Expected share of the exam's points: coverage × memory on the exam day. */
  score: Range
}

export interface Forecast {
  method: ForecastMethod
  goals: GoalForecast[]
}

/** Labelled blocks the completion model needs before the forecast trusts it over the bootstrap. */
export const MODEL_MIN_EXAMPLES = 10
export const BOOTSTRAP_DAYS = 28
export const BOOTSTRAP_MIN_DAYS = 7
export const FORECAST_RUNS = 1000
const CAPACITY_NOISE = 0.3

const round3 = (x: number) => Math.round(x * 1000) / 1000

function range(values: number[]): Range {
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q: number) => round3(sorted[Math.floor(q * (sorted.length - 1))] ?? 0)
  return { p10: at(0.1), p50: at(0.5), p90: at(0.9) }
}

export function forecastMethod(input: Pick<ForecastInput, 'completion' | 'history' | 'today'>) {
  if (input.completion && input.completion.n >= MODEL_MIN_EXAMPLES) return 'model'
  const from = addDays(input.today, -BOOTSTRAP_DAYS)
  const days = input.history.filter((d) => d.date >= from && d.date < input.today)
  return days.length >= BOOTSTRAP_MIN_DAYS ? 'bootstrap' : 'capacity'
}

export function forecast(input: ForecastInput): Forecast {
  const runs = input.runs ?? FORECAST_RUNS
  const method = forecastMethod(input)
  const goals = input.goals.filter((g) => g.on > input.today && g.scopeMinutes > 0)
  if (goals.length === 0) return { method, goals: [] }
  const lastDay = goals.reduce((m, g) => (g.on > m ? g.on : m), input.today)
  const days: LocalDate[] = []
  for (let d = input.today; d < lastDay; d = addDays(d, 1)) days.push(d)

  const queue = input.blocks
    .filter((b) => b.onDate >= input.today && b.minutes > 0)
    .map((b, i) => ({ b, i }))
    .sort((x, y) => (x.b.onDate < y.b.onDate ? -1 : x.b.onDate > y.b.onDate ? 1 : x.i - y.i))
    .map((x) => x.b)
  const byDay = new Map<LocalDate, ForecastBlock[]>()
  for (const b of queue) byDay.set(b.onDate, [...(byDay.get(b.onDate) ?? []), b])

  const from = addDays(input.today, -BOOTSTRAP_DAYS)
  const past = input.history.filter((d) => d.date >= from && d.date < input.today)
  const weekend = (d: LocalDate) => weekdayOf(d) >= 5
  const pastBy = (w: boolean) => {
    const own = past.filter((d) => weekend(d.date) === w)
    return own.length > 0 ? own : past
  }
  const pastWeekday = pastBy(false)
  const pastWeekend = pastBy(true)

  const random = seededRandom(input.seed)
  const normal = normalFrom(random)
  const covered = goals.map(() => [] as number[])

  for (let run = 0; run < runs; run++) {
    const post = method === 'model' ? sampleFixed(input.completion!, normal) : null
    const speed = Math.exp(input.speedSd * normal())
    const left = queue.map((b) => b.minutes)
    let head = 0
    const done = goals.map(() => 0)
    for (const d of days) {
      let minutes = 0
      if (post) {
        for (const b of byDay.get(d) ?? [])
          if (random() < completionProbability(post, b.features, b.subjectId)) minutes += b.minutes
      } else if (method === 'bootstrap') {
        const pool = weekend(d) ? pastWeekend : pastWeekday
        minutes = pool[Math.floor(random() * pool.length)]!.minutes
      } else {
        minutes = (input.capacity[d] ?? 0) * (1 + CAPACITY_NOISE * (2 * random() - 1))
      }
      // The day's minutes take the planned work in order; slower means less material per minute.
      while (minutes > 0 && head < queue.length) {
        const take = Math.min(minutes, left[head]!)
        const b = queue[head]!
        if (b.learn && b.goalId)
          goals.forEach((g, k) => {
            if (g.id === b.goalId && d < g.on) done[k]! += take / speed
          })
        left[head]! -= take
        minutes -= take
        if (left[head]! <= 1e-9) head++
      }
    }
    done.forEach((m, k) => covered[k]!.push(m))
  }

  return {
    method,
    goals: goals.map((g, k) => {
      const totals = covered[k]!.map((m) => Math.min(g.scopeMinutes, g.coveredMinutes + m))
      const shares = totals.map((m) => m / g.scopeMinutes)
      const required = Math.min(g.requiredMinutes, g.scopeMinutes)
      return {
        goalId: g.id,
        coverage: range(shares),
        pRequired: round3(totals.filter((m) => m >= required - 0.5).length / runs),
        score: range(shares.map((s) => s * g.recallOnExam)),
      }
    }),
  }
}
