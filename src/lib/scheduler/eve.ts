import { addDays, type LocalDate } from '@/lib/day'
import { slotMinutes } from '@/lib/schedule'
import type { PlanGoal, PlanState } from './types'

/** How far back from the exam a reserved day may move when later days are taken. */
export const EVE_MAX_BACK_DAYS = 7

/**
 * "Dan pred ispit" (PRD, Stage 10c): the reserved day of an exam is its last study day before the
 * exam (a day with free time and a cap). Two exams with the same day: the closer exam (earlier
 * date, then earlier time) keeps it and the other one takes the study day before, so every
 * reserved day belongs to one exam. Days before `state.from` are not planned and never reserved.
 */
export function reservedDays(state: PlanState): Map<LocalDate, PlanGoal> {
  const out = new Map<LocalDate, PlanGoal>()
  const exams = state.goals.filter((g) => g.kind === 'exam' && g.eveReserved).sort(closerFirst)
  for (const g of exams) {
    const day = eveDayFor(state, g, out)
    if (day) out.set(day, g)
  }
  return out
}

/**
 * The day an exam would get if it were reserved now, with the other reservations as they are,
 * and whether a closer exam already holds its last study day (the card then offers the day before).
 */
export function eveCandidate(
  state: PlanState,
  goalId: string,
): { day: LocalDate | null; takenBy: PlanGoal | null; lastStudyDay: LocalDate | null } {
  const goal = state.goals.find((g) => g.id === goalId && g.kind === 'exam')
  if (!goal) return { day: null, takenBy: null, lastStudyDay: null }
  const others = reservedDays({
    ...state,
    goals: state.goals.filter((g) => g.id !== goalId && closerFirst(g, goal) < 0),
  })
  const lastStudyDay = eveDayFor(state, goal, new Map())
  const day = eveDayFor(state, goal, others)
  return {
    day,
    takenBy: lastStudyDay && day !== lastStudyDay ? (others.get(lastStudyDay) ?? null) : null,
    lastStudyDay,
  }
}

function eveDayFor(
  state: PlanState,
  goal: PlanGoal,
  taken: Map<LocalDate, PlanGoal>,
): LocalDate | null {
  const study = new Map(state.days.map((d) => [d.date, Math.min(slotMinutes(d.slots), d.cap) > 0]))
  for (let back = 1; back <= EVE_MAX_BACK_DAYS; back++) {
    const day = addDays(goal.on, -back)
    if (day < state.from) return null
    if (!study.get(day) || taken.has(day)) continue
    return day
  }
  return null
}

function closerFirst(a: PlanGoal, b: PlanGoal): number {
  if (a.on !== b.on) return a.on < b.on ? -1 : 1
  const ta = a.atMin ?? 0
  const tb = b.atMin ?? 0
  if (ta !== tb) return ta - tb
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
