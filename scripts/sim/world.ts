import { addDays, type LocalDate } from '@/lib/day'
import type { Slot } from '@/lib/schedule'
import type { PlanGoal, PlanSubject, PlanUnit } from '@/lib/scheduler'
import type { Rng } from './random'

/** A generated semester slice: subjects, their units and exams, and weekly free time. */
export interface World {
  start: LocalDate
  days: number
  subjects: PlanSubject[]
  units: PlanUnit[]
  goals: PlanGoal[]
  /** Exam points per goal (the R × points metric). */
  points: Record<string, number>
  /** Free time by weekday (0 = Sunday) and the daily cap. */
  slots: (date: LocalDate) => Slot[]
  cap: (date: LocalDate) => number
}

export const SIM_START = '2026-11-02' // Monday

export const weekdayOf = (date: LocalDate) => new Date(`${date}T12:00:00Z`).getUTCDay()
export const isWeekend = (date: LocalDate) => [0, 6].includes(weekdayOf(date))

const WEEKDAY: Slot[] = [
  { startMin: 8 * 60, endMin: 10 * 60 },
  { startMin: 16 * 60, endMin: 22 * 60 },
]
const WEEKEND: Slot[] = [{ startMin: 10 * 60, endMin: 19 * 60 }]

export function makeWorld(r: Rng, subjectCount = r.int(3, 4)): World {
  const subjects: PlanSubject[] = []
  const units: PlanUnit[] = []
  const goals: PlanGoal[] = []
  const points: Record<string, number> = {}
  let last = 0
  for (let s = 0; s < subjectCount; s++) {
    const id = `s${s}`
    subjects.push({
      id,
      priority: r.int(2, 5),
      mode: 'regular',
      campaignStartOn: null,
      boostUntil: null,
      requiredShare: null,
    })
    const count = r.int(8, 14)
    const ids: string[] = []
    for (let i = 0; i < count; i++) {
      const unitId = `${id}-u${String(i + 1).padStart(2, '0')}`
      ids.push(unitId)
      units.push({
        id: unitId,
        subjectId: id,
        sourceId: `${id}-src`,
        order: i,
        kind: 'chapter',
        level: 0,
        minutes: 10 * r.int(3, 9),
        difficulty: r.int(2, 4),
        confidence: null,
        questionCount: 0,
        pageStart: i * 12 + 1,
        pageEnd: i * 12 + 12,
        nextReviewOn: null,
        coveredOn: null,
        tracked: false,
      })
    }
    const offset = r.int(21, 42)
    last = Math.max(last, offset)
    const goalId = `e${s}`
    goals.push({
      id: goalId,
      subjectId: id,
      kind: 'exam',
      on: addDays(SIM_START, offset),
      unitIds: ids,
      minutes: 0,
    })
    points[goalId] = 10 * r.int(4, 10)
  }
  return {
    start: SIM_START,
    days: last + 1,
    subjects,
    units,
    goals,
    points,
    slots: (date) => (isWeekend(date) ? WEEKEND : WEEKDAY).map((s) => ({ ...s })),
    cap: (date) => (isWeekend(date) ? 300 : 240),
  }
}
