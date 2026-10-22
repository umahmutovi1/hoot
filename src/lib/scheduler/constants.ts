/**
 * Scheduler constants (PRD "Prioritet i režim učenja", "Scheduler"). These are code, not user
 * settings: the UI only shows their effect.
 */

export interface PriorityRule {
  /** Multiplies urgency when subjects compete for a day. */
  weight: number
  /** FSRS target retention (Stage 9). */
  retention: number
  /** Share of the scope (by importance) that is required; the rest is optional. */
  coverage: number
  /** Extra buffer days before an exam. */
  extraBuffer: number
}

export const PRIORITY: Record<1 | 2 | 3 | 4 | 5, PriorityRule> = {
  1: { weight: 0.7, retention: 0.8, coverage: 0.7, extraBuffer: 0 },
  2: { weight: 0.85, retention: 0.8, coverage: 0.8, extraBuffer: 0 },
  3: { weight: 1, retention: 0.85, coverage: 0.9, extraBuffer: 0 },
  4: { weight: 1.2, retention: 0.9, coverage: 0.95, extraBuffer: 0 },
  5: { weight: 1.5, retention: 0.9, coverage: 1, extraBuffer: 1 },
}

export function priorityRule(priority: number): PriorityRule {
  const p = Math.min(5, Math.max(1, Math.round(priority))) as 1 | 2 | 3 | 4 | 5
  return PRIORITY[p]
}

/** Temporary boost multiplies urgency weight, also at priority 5. */
export const BOOST_WEIGHT = 1.3

/** Planned share even at ρ = 1, so one bad day does not topple the plan. */
export const RESERVE = 0.9

/** ρ is shrunk towards this value with weight 7 days and clamped to [0.5, 1]. */
export const RHO_PRIOR = 0.8
export const RHO_PRIOR_DAYS = 7
export const RHO_MIN = 0.5
export const RHO_MAX = 1
export const RHO_WINDOW_DAYS = 14

/** Growth limit: a day plans at most 1.25× the previous day's limit, from 1.25 × the 7-day average. */
export const GROWTH = 1.25
export const GROWTH_FLOOR_MIN = 60
export const GROWTH_WINDOW_DAYS = 7

/** Remaining work by level: chapters 0 → 100%, 1 → 40%, 2+ → 0; questions 0 → 100%, 1 → 50%. */
export function workShare(kind: 'chapter' | 'question', level: number): number {
  if (level <= 0) return 1
  if (kind === 'question') return level === 1 ? 0.5 : 0
  return level === 1 ? 0.4 : 0
}

/** Target coverage from the target grade: needed share + 10 p.p. */
export const TARGET_MARGIN = 0.1

/** Campaign start: margin of 20% of the work, at least 2 days. */
export const CAMPAIGN_MARGIN = 0.2
export const CAMPAIGN_MIN_MARGIN_DAYS = 2

export const RECAP_MINUTES = 15

/** A check of one unit in a review block (recall gate series, Stage 9). */
export function reviewMinutes(kind: 'chapter' | 'question', minutes: number): number {
  if (kind === 'question') return 3
  return Math.min(20, Math.max(5, Math.round(minutes * 0.15)))
}

/** Bump when the algorithm changes, so an old plan is not reused for the same input. */
export const SCHEDULER_VERSION = 2
