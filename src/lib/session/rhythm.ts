import { activeMs, MINUTE, type Preset, type Segment } from './timer'

/**
 * Session rhythm (PRD "Timer, pauza i rekalibracija" → Ritam sesije, Sprint 17): from segment
 * timestamps, the median study stretch before the first pause, the median pause and the share of
 * sessions ended before their planned length, over the last 6 weeks. When it clearly differs
 * from the default preset, a card offers the user's own work/break ("prebaci na 40/10?"); it is
 * never changed silently.
 */

export interface RhythmSession {
  segments: Segment[]
  endedAt: Date
  /** Planned length (block or chosen at start); null = open-ended. */
  plannedMinutes: number | null
}

export interface SessionRhythm {
  sessions: number
  /** Median minutes of study before the first pause (a session without one counts whole). */
  firstBreakMin: number
  /** Median pause in minutes; null when no session had a pause. */
  pauseMin: number | null
  /** Share of sessions with a planned length that ended at least 5 min before it. */
  earlyShare: number
}

export const RHYTHM_DAYS = 42
export const RHYTHM_MIN_SESSIONS = 8
/** A pause shorter than this is a unit switch, not a break (as `pauseStats()`). */
const PAUSE_MIN_MS = 2_000
/** Pauses longer than this are the session's end in all but name (lunch, sleep). */
const PAUSE_MAX_MS = 60 * MINUTE
const EARLY_MIN = 5
/** The work part must differ by at least this from the preset to be a clear difference. */
export const RHYTHM_WORK_GAP = 10
const DAY_MS = 86_400_000

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function stretches(segments: Segment[], endedAt: Date) {
  const list = segments
    .filter((s) => s.startedAt.getTime() < endedAt.getTime())
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
  let first: number | null = null
  let run = 0
  const pauses: number[] = []
  for (let i = 0; i < list.length; i++) {
    const s = list[i]!
    const end = (s.endedAt ?? endedAt).getTime()
    run += Math.max(0, end - s.startedAt.getTime())
    const next = list[i + 1]
    if (!next) break
    const gap = next.startedAt.getTime() - end
    if (gap > PAUSE_MIN_MS) {
      if (first === null) first = run
      if (gap <= PAUSE_MAX_MS) pauses.push(gap)
    }
  }
  return { first: (first ?? run) / MINUTE, pauses: pauses.map((p) => p / MINUTE) }
}

export function sessionRhythm(sessions: RhythmSession[], now: Date): SessionRhythm | null {
  const recent = sessions.filter(
    (s) => s.segments.length > 0 && now.getTime() - s.endedAt.getTime() <= RHYTHM_DAYS * DAY_MS,
  )
  if (recent.length < RHYTHM_MIN_SESSIONS) return null
  const firsts: number[] = []
  const pauses: number[] = []
  let planned = 0
  let early = 0
  for (const s of recent) {
    const r = stretches(s.segments, s.endedAt)
    firsts.push(r.first)
    pauses.push(...r.pauses)
    if (s.plannedMinutes) {
      planned++
      if (activeMs(s.segments, s.endedAt) / MINUTE < s.plannedMinutes - EARLY_MIN) early++
    }
  }
  return {
    sessions: recent.length,
    firstBreakMin: Math.round(median(firsts)),
    pauseMin: pauses.length > 0 ? Math.round(median(pauses)) : null,
    earlyShare: planned > 0 ? Math.round((early / planned) * 1000) / 1000 : 0,
  }
}

const round5 = (x: number) => Math.round(x / 5) * 5

/**
 * "Tvoje sesije traju oko 38 min — prebaci na 40/10?": the user's own cycle when its work part
 * differs from the preset's first work step by `RHYTHM_WORK_GAP` or more. Flowtime and free
 * presets have no fixed length to compare with.
 */
export function rhythmSuggestion(
  rhythm: SessionRhythm | null,
  preset: Preset,
): { workMin: number; breakMin: number; aboutMin: number } | null {
  if (!rhythm || preset.kind !== 'cycle') return null
  const work = preset.steps.find((s) => s.kind === 'work')?.min
  const pause = preset.steps.find((s) => s.kind === 'break')?.min ?? 10
  if (!work) return null
  const workMin = Math.min(90, Math.max(20, round5(rhythm.firstBreakMin)))
  if (Math.abs(workMin - work) < RHYTHM_WORK_GAP) return null
  const breakMin = Math.min(30, Math.max(5, round5(rhythm.pauseMin ?? (pause * workMin) / work)))
  return { workMin, breakMin, aboutMin: rhythm.firstBreakMin }
}
