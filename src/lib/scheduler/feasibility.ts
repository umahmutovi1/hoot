import { addDays, type LocalDate } from '@/lib/day'
import { aiCapacity, learnEndOf, remainingWork } from './plan'
import { growthLimit } from './realization'
import type { PlanState } from './types'

/**
 * Feasibility test (ROADMAP 11a, RESEARCH-ML 5.4): can the required work of every goal fit its
 * days at all, whatever the order? Each goal's work may go on any day of its window (from its
 * release, a manual campaign start, to the day before its learn end) up to the day's capacity as
 * `plan()` sees it (`aiCapacity()` and the growth limit). With interval windows this is a
 * transportation problem whose max flow follows from intervals (Hall's condition): the shortfall
 * is the largest sum of `need − capacity` over disjoint day intervals. A relaxation of `plan()`
 * (reviews, subjects per day, minimum blocks and reserved eves are left out), so a shortfall here
 * is a deficit any plan has; no shortfall should mean `plan()` has none either (property test).
 */

export interface GoalWindow {
  goalId: string
  /** Required (not optional) minutes left. */
  need: number
  /** Day indices into `state.days`, inclusive; `last < first` = no day to learn on. */
  first: number
  last: number
}

export interface Feasibility {
  feasible: boolean
  /** Least required minutes that cannot fit, whatever the plan (0 when feasible). */
  shortfall: number
  /** The interval with the largest shortfall, for an explanation; null when feasible. */
  tightest: { from: LocalDate; to: LocalDate; need: number; capacity: number } | null
  windows: GoalWindow[]
}

/** Capacity per day as `plan()` uses it: AI capacity, never above the growth ramp. */
export function dayCapacity(state: PlanState): number[] {
  return aiCapacity(state).map((c, k) => Math.min(c, growthLimit(state.growthBase, k)))
}

export function goalWindows(state: PlanState): GoalWindow[] {
  const index = new Map(state.days.map((d, i) => [d.date, i] as const))
  const indexOf = (date: LocalDate) => {
    if (date < state.from) return 0
    return index.get(date) ?? state.days.length - 1
  }
  const subjects = new Map(state.subjects.map((s) => [s.id, s]))
  const need = new Map<string, number>()
  for (const w of remainingWork(state))
    if (!w.optional) need.set(w.goalId, (need.get(w.goalId) ?? 0) + w.minutes)
  return state.goals
    .map((g) => {
      const subject = subjects.get(g.subjectId)
      const end = addDays(learnEndOf(state, g, subject), -1)
      const release =
        subject?.mode === 'campaign' && subject.campaignStartOn ? subject.campaignStartOn : null
      return {
        goalId: g.id,
        need: need.get(g.id) ?? 0,
        first: release ? indexOf(release) : 0,
        last: end < state.from ? -1 : Math.min(indexOf(end), state.days.length - 1),
      }
    })
    .filter((w) => w.need > 0)
}

export function feasibility(state: PlanState): Feasibility {
  const windows = goalWindows(state)
  const cap = dayCapacity(state)
  const prefix = [0]
  for (const c of cap) prefix.push(prefix[prefix.length - 1]! + c)

  // Goals without any day cannot fit at all.
  const stranded = windows.filter((w) => w.last < w.first)
  let shortfall = stranded.reduce((s, w) => s + w.need, 0)
  let tightest: Feasibility['tightest'] = null
  let worst = 0

  const placed = windows.filter((w) => w.last >= w.first)
  const n = state.days.length
  // best[b] = the largest shortfall over disjoint intervals that end before day b.
  const best = new Array<number>(n + 1).fill(0)
  for (let b = 0; b < n; b++) {
    best[b + 1] = best[b]!
    for (let a = 0; a <= b; a++) {
      let need = 0
      for (const w of placed) if (w.first >= a && w.last <= b) need += w.need
      const capacity = prefix[b + 1]! - prefix[a]!
      const over = need - capacity
      if (over <= 0) continue
      best[b + 1] = Math.max(best[b + 1]!, best[a]! + over)
      if (over > worst) {
        worst = over
        tightest = { from: state.days[a]!.date, to: state.days[b]!.date, need, capacity }
      }
    }
  }
  shortfall += best[n]!
  shortfall = Math.round(shortfall)
  if (stranded.length > 0 && !tightest) {
    const need = stranded.reduce((s, w) => s + w.need, 0)
    tightest = { from: state.from, to: state.from, need, capacity: 0 }
  }
  return { feasible: shortfall <= 0, shortfall, tightest: shortfall > 0 ? tightest : null, windows }
}
