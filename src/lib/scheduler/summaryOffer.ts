import { plan } from './plan'
import type { PlanResult, PlanState } from './types'

/**
 * "Sažetak umjesto čitanja" (PRD "Tekst izvora, sažetak i kartice", Sprint 18): when a goal of a
 * lower-priority subject (1–2) has a deficit, its unread chapters with source text can be studied
 * through their summaries. The offer is computed with a dry run of `plan()` in which those units
 * take their summary time, so the card says whether the work then fits.
 */

/** Subjects up to this priority get the offer (PRD: "za gradivo prioriteta 1–2"). */
export const SUMMARY_OFFER_MAX_PRIORITY = 2

export interface SummaryOffer {
  goalId: string
  subjectId: string
  unitIds: string[]
  /** Planned reading time of those units now. */
  readMinutes: number
  /** Their time through summaries. */
  summaryMinutes: number
  /** The goal's deficit now and after the switch (0 = it fits). */
  deficitBefore: number
  deficitAfter: number
}

export function summaryOffer(
  state: PlanState,
  result: PlanResult,
  goalId: string,
  /** Units that have source text. */
  hasText: ReadonlySet<string>,
  /** Summary time of a unit from its reading time (`summaryMinutes()` with its words and pace). */
  summaryTime: (unitId: string, readingMinutes: number) => number,
): SummaryOffer | null {
  const deficit = result.deficits.find((d) => d.goalId === goalId)
  const goal = state.goals.find((g) => g.id === goalId)
  if (!deficit || !goal || goal.kind !== 'exam') return null
  const subject = state.subjects.find((s) => s.id === goal.subjectId)
  if (!subject || subject.priority > SUMMARY_OFFER_MAX_PRIORITY) return null

  const inGoal = new Set(goal.unitIds)
  const candidates = state.units.filter(
    (u) => inGoal.has(u.id) && u.kind === 'chapter' && u.level === 0 && hasText.has(u.id),
  )
  const switched = new Map<string, number>()
  for (const u of candidates) {
    const m = summaryTime(u.id, u.minutes)
    if (m < u.minutes) switched.set(u.id, m)
  }
  if (switched.size === 0) return null

  const dry = plan({
    ...state,
    units: state.units.map((u) =>
      switched.has(u.id) ? { ...u, minutes: switched.get(u.id)! } : u,
    ),
  })
  const after = dry.deficits.find((d) => d.goalId === goalId)?.minutes ?? 0
  if (after >= deficit.minutes) return null

  const chosen = candidates.filter((u) => switched.has(u.id))
  return {
    goalId,
    subjectId: subject.id,
    unitIds: chosen.map((u) => u.id),
    readMinutes: chosen.reduce((s, u) => s + u.minutes, 0),
    summaryMinutes: chosen.reduce((s, u) => s + switched.get(u.id)!, 0),
    deficitBefore: deficit.minutes,
    deficitAfter: after,
  }
}
