/**
 * Timer state from segment timestamps (PRD "Timer, pauza i rekalibracija"). A session is a list of
 * segments; time is always `end − start` of those segments, never a counter, so a locked phone or
 * a closed tab loses nothing. Pauses are the gaps between segments.
 */

export interface Segment {
  id: string
  unitId: string | null
  startedAt: Date
  /** null = the segment is running */
  endedAt: Date | null
}

export type TimerStatus = 'running' | 'paused'

export const MINUTE = 60_000

/** The open segment, if the timer is running. */
export function openSegment(segments: Segment[]): Segment | null {
  return segments.find((s) => s.endedAt === null) ?? null
}

export function timerStatus(segments: Segment[]): TimerStatus {
  return openSegment(segments) ? 'running' : 'paused'
}

function sorted(segments: Segment[]): Segment[] {
  return [...segments].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
}

function durationMs(s: Segment, now: Date): number {
  return Math.max(0, (s.endedAt ?? now).getTime() - s.startedAt.getTime())
}

/** Studied time: the sum of all segments, the open one counted until `now`. */
export function activeMs(segments: Segment[], now: Date): number {
  return segments.reduce((sum, s) => sum + durationMs(s, now), 0)
}

/** Studied time per unit (`null` = no unit picked). */
export function msByUnit(segments: Segment[], now: Date): Map<string | null, number> {
  const out = new Map<string | null, number>()
  for (const s of segments) out.set(s.unitId, (out.get(s.unitId) ?? 0) + durationMs(s, now))
  return out
}

/** Two segments closer than this are one stretch of work (a "Sad radim na" switch, not a pause). */
const SWITCH_GAP_MS = 2_000

export interface PauseStats {
  count: number
  ms: number
}

/**
 * Pauses = gaps between stretches of work. Total pause time is "first start to end (or now) minus
 * studied time"; a trailing pause (timer paused right now) counts as well.
 */
export function pauseStats(
  segments: Segment[],
  now: Date,
  endedAt: Date | null = null,
): PauseStats {
  const list = sorted(segments)
  if (list.length === 0) return { count: 0, ms: 0 }
  let count = 0
  for (let i = 1; i < list.length; i++) {
    const prevEnd = list[i - 1]!.endedAt
    if (prevEnd && list[i]!.startedAt.getTime() - prevEnd.getTime() > SWITCH_GAP_MS) count++
  }
  const last = list[list.length - 1]!
  const end = endedAt ?? now
  if (last.endedAt && end.getTime() - last.endedAt.getTime() > SWITCH_GAP_MS) count++
  const span = end.getTime() - list[0]!.startedAt.getTime()
  return { count, ms: Math.max(0, span - activeMs(list, end)) }
}

/** Start of the current stretch of work: back through segments joined by unit switches. */
function stretchStart(list: Segment[]): Date {
  let i = list.length - 1
  while (i > 0) {
    const prevEnd = list[i - 1]!.endedAt
    if (!prevEnd || list[i]!.startedAt.getTime() - prevEnd.getTime() > SWITCH_GAP_MS) break
    i--
  }
  return list[i]!.startedAt
}

export type TimerMode = 'pomodoro25' | 'pomodoro50' | 'free'

export const TIMER_MODES: TimerMode[] = ['pomodoro25', 'pomodoro50', 'free']

const INTERVALS: Record<Exclude<TimerMode, 'free'>, { workMin: number; breakMin: number }> = {
  pomodoro25: { workMin: 25, breakMin: 5 },
  pomodoro50: { workMin: 50, breakMin: 10 },
}

export interface IntervalReminder {
  /** `work`: counting down to a break; `break`: counting down to getting back to work. */
  phase: 'work' | 'break'
  /** ms left in the phase; ≤ 0 = the phase is over ("Vrijeme je za pauzu" / "Vrijeme je za nastavak"). */
  remainingMs: number
  /** Length of the phase, for a progress ring. */
  totalMs: number
}

/**
 * 25/5 and 50/10 are reminders only (PRD decision, Stage 7): the countdown never opens or closes
 * a segment. Work counts from the start of the current stretch, a break from the last segment end.
 */
export function intervalReminder(
  mode: TimerMode,
  segments: Segment[],
  now: Date,
): IntervalReminder | null {
  if (mode === 'free' || segments.length === 0) return null
  const { workMin, breakMin } = INTERVALS[mode]
  const list = sorted(segments)
  const last = list[list.length - 1]!
  if (last.endedAt === null) {
    const totalMs = workMin * MINUTE
    return {
      phase: 'work',
      totalMs,
      remainingMs: totalMs - (now.getTime() - stretchStart(list).getTime()),
    }
  }
  const totalMs = breakMin * MINUTE
  return {
    phase: 'break',
    totalMs,
    remainingMs: totalMs - (now.getTime() - last.endedAt.getTime()),
  }
}

/** A segment running longer than this asks "Jesi li učila do sad?". */
export const FORGOTTEN_AFTER_MS = 3 * 60 * MINUTE

/** The open segment when it has been running for more than 3 h. */
export function forgottenSegment(segments: Segment[], now: Date): Segment | null {
  const open = openSegment(segments)
  if (!open) return null
  return now.getTime() - open.startedAt.getTime() > FORGOTTEN_AFTER_MS ? open : null
}

/** Default answer to "Završila sam u …": 25 min after the segment started, never after `now`. */
export function suggestedEnd(segment: Segment, now: Date): Date {
  return new Date(Math.min(segment.startedAt.getTime() + 25 * MINUTE, now.getTime()))
}

/**
 * Ends the session at `at` (the corrected end of a forgotten timer, or `now`): segments are cut at
 * `at`, segments that start after it are dropped. Returns the segments to keep and the ids to drop.
 */
export function closeAt(segments: Segment[], at: Date): { keep: Segment[]; drop: string[] } {
  const keep: Segment[] = []
  const drop: string[] = []
  for (const s of segments) {
    if (s.startedAt.getTime() >= at.getTime()) drop.push(s.id)
    else if (s.endedAt === null || s.endedAt.getTime() > at.getTime())
      keep.push({ ...s, endedAt: at })
    else keep.push(s)
  }
  return { keep, drop }
}
