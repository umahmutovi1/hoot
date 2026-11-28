/**
 * The shape of one session of a known length (board PokreniSesiju, "Hoot bira"): how many study
 * stretches and breaks fit, so a 30 min session never offers a 50/15 rhythm. Pure, no React.
 */
import {
  activeMs,
  breakMinAfter,
  MINUTE,
  openSegment,
  presetReminder,
  rhythmId,
  RHYTHM_WORK,
  workMinAt,
  type IntervalReminder,
  type Preset,
  type Segment,
} from './timer'

/** The rhythm id the session picker uses for "Hoot bira"; resolved by `autoRhythmId()` at start. */
export const AUTO_RHYTHM = 'auto'

/** Up to this many minutes a session is one stretch: no break, it simply ends. */
export const ONE_STRETCH_MAX = 30
/** Up to this many minutes: two halves with one short break between them. */
export const TWO_HALVES_MAX = 55
export const SHORT_BREAK = 5
/** A break is only worth it when at least this much study follows it. */
export const MIN_TAIL = 10

export interface ShapeStep {
  kind: 'work' | 'break'
  min: number
}

/**
 * "Hoot bira": one stretch up to 30 min (no break), two halves with 5 min in between up to 55,
 * and the user's default rhythm for anything longer.
 */
export function autoRhythmId(minutes: number, defaultId: string): string {
  if (minutes <= ONE_STRETCH_MAX) return rhythmId(clampWork(minutes), SHORT_BREAK)
  if (minutes <= TWO_HALVES_MAX)
    return rhythmId(clampWork(Math.ceil((minutes - SHORT_BREAK) / 2)), SHORT_BREAK)
  return defaultId
}

const clampWork = (m: number) => Math.max(RHYTHM_WORK.min, Math.min(RHYTHM_WORK.max, m))

/**
 * Study and break steps of a session of `minutes` in `preset`: a break only when at least
 * `MIN_TAIL` minutes of study come after it, otherwise the last stretch runs to the end.
 * Flowtime and free are one stretch (their breaks are not known in advance).
 */
export function sessionShape(minutes: number, preset: Preset): ShapeStep[] {
  if (minutes <= 0) return []
  if (preset.kind !== 'cycle') return [{ kind: 'work', min: minutes }]
  const out: ShapeStep[] = []
  let left = minutes
  for (let n = 0; left > 0; n++) {
    const work = Math.min(workMinAt(preset, n), left)
    out.push({ kind: 'work', min: work })
    left -= work
    const pause = breakMinAfter(preset, n)
    if (left <= 0) break
    if (pause > 0 && left >= pause + MIN_TAIL) {
      out.push({ kind: 'break', min: pause })
      left -= pause
    } else {
      out[out.length - 1]!.min += left
      left = 0
    }
  }
  return out
}

/** Study minutes and breaks of a shape ("25 min učenja · 1 pauza"). */
export function shapeTotals(shape: ShapeStep[]): { studyMin: number; breaks: number } {
  return {
    studyMin: shape.filter((s) => s.kind === 'work').reduce((a, s) => a + s.min, 0),
    breaks: shape.filter((s) => s.kind === 'break').length,
  }
}

export type SessionReminder = IntervalReminder | EndReminder

/** Counting down to the end of a session with a planned length; ≤ 0 = time is up. */
export interface EndReminder {
  phase: 'end'
  remainingMs: number
  totalMs: number
}

/**
 * The timer badge with the session's planned length in mind: while studying, when the rest of
 * the session after this interval would be too short for a break and some study (the same rule
 * as `sessionShape()`), the badge counts down to the end instead of to a break that never comes.
 */
export function sessionReminder(
  preset: Preset,
  segments: Segment[],
  now: Date,
  plannedMin: number | null,
): SessionReminder | null {
  const interval = presetReminder(preset, segments, now)
  if (!plannedMin || !openSegment(segments)) return interval
  const totalMs = plannedMin * MINUTE
  const left = totalMs - activeMs(segments, now)
  const end: EndReminder = { phase: 'end', remainingMs: left, totalMs }
  if (!interval || interval.phase !== 'work') return end
  // After this interval, is there room for a break and at least MIN_TAIL of study?
  const afterInterval = left - interval.remainingMs
  return afterInterval < (SHORT_BREAK + MIN_TAIL) * MINUTE ? end : interval
}
