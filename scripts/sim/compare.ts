import type { Summary } from './run'

/** Which way is better for each baseline metric (completion shares describe the student). */
export const BETTER: Record<keyof Summary, 'higher' | 'lower' | null> = {
  examScore: 'higher',
  deficitMin: 'lower',
  missedShare: 'lower',
  planChurn: 'lower',
  loadSd: 'lower',
  completionAvoided: null,
  completionNeutral: null,
}

/**
 * Tolerance per metric (decision 29 Oct 2026): the exam score is the goal (2%); the others may
 * get worse by at most 5% when the exam score holds.
 */
export const TOLERANCE: Record<keyof Summary, number> = {
  examScore: 0.02,
  deficitMin: 0.05,
  missedShare: 0.05,
  planChurn: 0.05,
  loadSd: 0.05,
  completionAvoided: 0,
  completionNeutral: 0,
}

/**
 * Metrics that got worse than the baseline by more than their tolerance (relative, with an
 * absolute floor so a metric near 0 does not fail on noise). DoD of every Stage 11a model: none.
 */
export function worse(now: Summary, baseline: Summary): (keyof Summary)[] {
  return (Object.keys(BETTER) as (keyof Summary)[]).filter((k) => {
    const way = BETTER[k]
    if (!way) return false
    const slack = Math.max(Math.abs(baseline[k]) * TOLERANCE[k], 0.005)
    return way === 'higher' ? now[k] < baseline[k] - slack : now[k] > baseline[k] + slack
  })
}
