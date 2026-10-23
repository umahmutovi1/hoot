import type { LocalDate } from '@/lib/day'
import { lastReviewDay, learnEndOf, type PlanState } from '@/lib/scheduler'

/** What a review of a unit needs from the plan: the subject's priority and the exam limit. */
export interface ReviewLimit {
  priority: number
  /** Last day a review may fall on before the unit's nearest exam; null without one. */
  lastDay: LocalDate | null
}

/**
 * Per unit from the plan state: its subject's priority and the last day before its nearest
 * upcoming exam (first buffer day, or the day before the exam), the same rule `plan()` uses.
 */
export function reviewLimits(state: PlanState, today: LocalDate): Map<string, ReviewLimit> {
  const subjects = new Map(state.subjects.map((s) => [s.id, s]))
  const out = new Map<string, ReviewLimit>()
  const goals = [...state.goals]
    .filter((g) => g.kind === 'exam' && g.on > today)
    .sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : a.id.localeCompare(b.id)))
  for (const u of state.units) {
    const subject = subjects.get(u.subjectId)
    const goal = goals.find((g) => g.unitIds.includes(u.id))
    out.set(u.id, {
      priority: subject?.priority ?? 3,
      lastDay: goal ? lastReviewDay(goal, learnEndOf(state, goal, subject), today) : null,
    })
  }
  return out
}
