/**
 * Leaving the app during a running session (RESEARCH-ML 5.2, Stage 11 "Uvidi" → ometanja). Only
 * leaves with the timer running count, and a glance shorter than `MIN_AWAY_SEC` (a lock screen,
 * a notification) is not a leave. Times come from timestamps, never from ticks.
 */

export const MIN_AWAY_SEC = 5

/** Seconds away from `hiddenAt` to `visibleAt`, or null when it was too short to count. */
export function awaySeconds(hiddenAt: Date, visibleAt: Date): number | null {
  const sec = Math.round((visibleAt.getTime() - hiddenAt.getTime()) / 1000)
  return sec >= MIN_AWAY_SEC ? sec : null
}

export interface AwayCounts {
  app_leaves: number
  app_away_sec: number
}

export function addAway(counts: AwayCounts, sec: number): AwayCounts {
  return { app_leaves: counts.app_leaves + 1, app_away_sec: counts.app_away_sec + sec }
}
