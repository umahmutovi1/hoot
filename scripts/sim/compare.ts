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
 * Metrics that got worse than the baseline by more than `tolerance` (relative, with an absolute
 * floor so a metric near 0 does not fail on noise). DoD of every Stage 11a model: none.
 */
export function worse(now: Summary, baseline: Summary, tolerance = 0.02): (keyof Summary)[] {
  return (Object.keys(BETTER) as (keyof Summary)[]).filter((k) => {
    const way = BETTER[k]
    if (!way) return false
    const slack = Math.max(Math.abs(baseline[k]) * tolerance, 0.005)
    return way === 'higher' ? now[k] < baseline[k] - slack : now[k] > baseline[k] + slack
  })
}
