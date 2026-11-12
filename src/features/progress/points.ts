import {
  GRADES,
  gradeFor,
  gradeThreshold,
  pointsRange,
  type GradeStatus,
  type GradeSubject,
  type Projection,
} from '@/lib/grades'

const GRADE_SPAN = [5, ...GRADES]

/** What the call-out under a subject's points says (board Bodovi). */
export type PointsCall =
  | { kind: 'none'; first: { id: string; worth: number } | null; grade: number; need: number }
  | { kind: 'secured'; grade: number }
  | { kind: 'unreachable'; grade: number; max: number }
  | {
      kind: 'needs'
      grade: number
      points: number
      remaining: number
      /** Forecast of the final points; null without a forecast. */
      range: { low: number; high: number } | null
      /** The forecast's lower end falls below a pass. */
      risk: boolean
    }

export interface PointsCard {
  have: number
  total: number
  /** Thresholds of 6–10 in points. */
  ticks: number[]
  /** Points the target (or a pass, without one) needs. */
  goal: number
  goalGrade: number
  range: { low: number; high: number } | null
  /** Every grade the forecast spans, low to high ("7 ili 8"). */
  rangeGrades: number[]
  call: PointsCall
}

/**
 * One subject on the Bodovi screen: earned points, the grade thresholds, the target marker,
 * the forecast band and what is still needed. `score` is the subject's nearest exam forecast.
 */
export function pointsCard(
  projection: Projection,
  grading: GradeSubject,
  target: number | null,
  score: { p10: number; p90: number } | null,
): PointsCard {
  const total = grading.pointsTotal
  const goalGrade = target ?? 6
  const ticks = GRADES.map((g) => gradeThreshold(g, grading))
  const range = score && projection.remaining > 0 ? pointsRange(projection, score) : null
  const scale = ticks.map((p) => (p / total) * 100)
  const span = range
    ? [gradeFor((range.low / total) * 100, scale), gradeFor((range.high / total) * 100, scale)]
    : []
  const rangeGrades = range ? GRADE_SPAN.filter((g) => g >= span[0]! && g <= span[1]!) : []
  const status: GradeStatus = projection.grades.find((g) => g.grade === goalGrade)!
  const goal = gradeThreshold(goalGrade, grading)
  const card = { have: projection.have, total, ticks, goal, goalGrade, range, rangeGrades }
  if (projection.have === 0 && projection.slots.every((s) => s.state === 'open')) {
    const first = projection.remainingSlots[0]
    return {
      ...card,
      call: {
        kind: 'none',
        first: first ? { id: first.itemId, worth: first.worth } : null,
        grade: goalGrade,
        need: goal,
      },
    }
  }
  if (status.kind === 'secured') return { ...card, call: { kind: 'secured', grade: goalGrade } }
  if (status.kind === 'unreachable')
    return {
      ...card,
      call: { kind: 'unreachable', grade: goalGrade, max: projection.maxPossible },
    }
  return {
    ...card,
    call: {
      kind: 'needs',
      grade: goalGrade,
      points: status.points,
      remaining: projection.remaining,
      range,
      risk: range !== null && range.low < ticks[0]! - 1e-9,
    },
  }
}
