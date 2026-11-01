// Celebrations (PRD "Dopune, 29. okt 2026" → Doživljaj): a short message, the ring animation and a
// vibration when a block, the whole day or the week's plan is done. Never a penalty for misses.

export type Milestone = 'block' | 'day' | 'week'

/** Today's blocks (done of not skipped) and this week's minutes (studied of planned). */
export interface Progress {
  /** Local date (`src/lib/day.ts`). */
  date: string
  /** Monday of the local week. */
  week: string
  doneToday: number
  plannedToday: number
  doneWeek: number
  plannedWeek: number
}

/**
 * The milestone reached between two snapshots of the same day, the biggest first; null when
 * nothing new was done (or the previous snapshot is from another day, e.g. the first open).
 */
export function milestoneBetween(prev: Progress | null, next: Progress): Milestone | null {
  if (!prev || prev.date !== next.date) return null
  if (
    prev.week === next.week &&
    next.plannedWeek > 0 &&
    prev.doneWeek < next.plannedWeek &&
    next.doneWeek >= next.plannedWeek
  )
    return 'week'
  if (next.doneToday <= prev.doneToday) return null
  if (
    next.plannedToday > 0 &&
    prev.doneToday < next.plannedToday &&
    next.doneToday >= next.plannedToday
  )
    return 'day'
  return 'block'
}

/** Short vibration patterns (ms); the bigger the milestone, the longer. */
export const VIBRATION: Record<Milestone | 'repeated' | 'passed', number[]> = {
  block: [18],
  repeated: [18],
  day: [20, 60, 20],
  week: [20, 60, 20, 60, 40],
  passed: [20, 60, 20, 60, 40],
}

/**
 * The snapshot to keep after `next`: done counts never go down within the same day / week, so a
 * screen that is still loading (fewer sessions for a moment) does not celebrate once it catches up.
 */
export function remembered(prev: Progress | null, next: Progress): Progress {
  if (!prev) return next
  return {
    ...next,
    doneToday: prev.date === next.date ? Math.max(prev.doneToday, next.doneToday) : next.doneToday,
    doneWeek: prev.week === next.week ? Math.max(prev.doneWeek, next.doneWeek) : next.doneWeek,
  }
}

/** True when a review moved a unit to "Ponovljeno" (level 3) for the first time. */
export function reachedRepeated(
  outcomes: { kind: 'unit' | 'card'; levelBefore: number; levelAfter: number }[],
): boolean {
  return outcomes.some((o) => o.kind === 'unit' && o.levelBefore < 3 && o.levelAfter >= 3)
}
