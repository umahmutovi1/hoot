import { addDays, type LocalDate } from '@/lib/day'
import { BUILT_IN_PRESETS } from '@/lib/session/timer'
import type { PlanDay, PlanGoal, PlanState, PlanSubject, PlanUnit } from './types'

/** Builders for scheduler tests. */

export const FROM = '2026-10-19' // Monday

export function days(
  count: number,
  slots = [{ startMin: 9 * 60, endMin: 21 * 60 }],
  cap = 240,
): PlanDay[] {
  return Array.from({ length: count }, (_, i) => ({
    date: addDays(FROM, i),
    slots: slots.map((s) => ({ ...s })),
    cap,
    lectureSubjectIds: [],
  }))
}

export function subject(id: string, over: Partial<PlanSubject> = {}): PlanSubject {
  return {
    id,
    priority: 3,
    mode: 'regular',
    campaignStartOn: null,
    boostUntil: null,
    requiredShare: null,
    ...over,
  }
}

export function units(
  subjectId: string,
  count: number,
  minutes = 60,
  over: Partial<PlanUnit> = {},
): PlanUnit[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${subjectId}-u${String(i + 1).padStart(2, '0')}`,
    subjectId,
    sourceId: `${subjectId}-src`,
    order: i,
    kind: 'chapter' as const,
    level: 0,
    minutes,
    difficulty: 3,
    confidence: null,
    questionCount: 0,
    pageStart: i * 10 + 1,
    pageEnd: i * 10 + 10,
    nextReviewOn: null,
    coveredOn: null,
    tracked: false,
    ...over,
  }))
}

export function exam(id: string, subjectId: string, on: LocalDate, unitIds: string[]): PlanGoal {
  return { id, subjectId, kind: 'exam', on, unitIds, minutes: 0 }
}

export function state(over: Partial<PlanState> = {}): PlanState {
  return {
    from: FROM,
    nowMin: null,
    days: days(28),
    subjects: [],
    goals: [],
    units: [],
    fixed: [],
    settings: {
      bufferDays: 1,
      maxSubjectsPerDay: 3,
      minBlockMinutes: 25,
      recapAfterLecture: false,
      reviewCapPct: 40,
      examEveEndMin: 23 * 60,
      lecturePaceDays: 7,
    },
    preset: BUILT_IN_PRESETS[0]!,
    rho: 1,
    growthBase: null,
    preferredParts: [],
    ...over,
  }
}

/** Minutes planned per day, per subject. */
export function minutesBy(blocks: { onDate: string; subjectId: string; minutes: number }[]) {
  const out = new Map<string, number>()
  for (const b of blocks)
    out.set(`${b.onDate}|${b.subjectId}`, (out.get(`${b.onDate}|${b.subjectId}`) ?? 0) + b.minutes)
  return out
}

export function dayTotal(blocks: { onDate: string; minutes: number }[], date: LocalDate) {
  return blocks.filter((b) => b.onDate === date).reduce((s, b) => s + b.minutes, 0)
}
