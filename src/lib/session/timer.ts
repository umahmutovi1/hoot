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

/**
 * Session presets (PRD "Timer, pauza i rekalibracija" → Predlošci sesije). A preset is a cycle of
 * study and break steps with an optional long break, Flowtime (break = study / 5) or free.
 * `study_sessions.timer_mode` stores the preset id. Presets are reminders only: the countdown
 * never opens or closes a segment (decision, Stage 7).
 */
export interface PresetStep {
  kind: 'work' | 'break'
  min: number
}

export type Preset =
  | {
      kind: 'cycle'
      id: string
      /** Custom presets carry their name; built-ins are named by i18n key. */
      name?: string
      steps: PresetStep[]
      longBreak: { every: number; min: number } | null
    }
  | { kind: 'flow'; id: 'flow' }
  | { kind: 'free'; id: 'free' }

export const DEFAULT_PRESET_ID = 'standard'

const cycle = (
  id: string,
  work: number,
  pause: number,
  longBreak: { every: number; min: number } | null = null,
): Preset => ({
  kind: 'cycle',
  id,
  steps: [
    { kind: 'work', min: work },
    { kind: 'break', min: pause },
  ],
  longBreak,
})

/** Built-in presets in picker order. */
export const BUILT_IN_PRESETS: Preset[] = [
  cycle('standard', 50, 15),
  cycle('pomodoro', 25, 5, { every: 4, min: 20 }),
  { kind: 'flow', id: 'flow' },
  { kind: 'free', id: 'free' },
]

/** Fixed modes from Stage 7; still valid for old sessions, never offered in pickers. */
const LEGACY_PRESETS: Preset[] = [cycle('pomodoro25', 25, 5), cycle('pomodoro50', 50, 10)]

export function isBuiltInPreset(id: string): boolean {
  return [...BUILT_IN_PRESETS, ...LEGACY_PRESETS].some((p) => p.id === id)
}

/** A custom preset as stored on the profile (`profiles.session_presets`). */
export interface CustomPresetRow {
  id: string
  name: string
  steps: PresetStep[]
  long_break: { every: number; min: number } | null
}

export function customPreset(row: CustomPresetRow): Preset {
  return { kind: 'cycle', id: row.id, name: row.name, steps: row.steps, longBreak: row.long_break }
}

/** The preset behind an id; an unknown or deleted custom preset falls back to Standardno. */
export function resolvePreset(
  id: string | null | undefined,
  custom: CustomPresetRow[] = [],
): Preset {
  const found =
    [...BUILT_IN_PRESETS, ...LEGACY_PRESETS].find((p) => p.id === id) ??
    custom.filter((c) => c.id === id).map(customPreset)[0]
  return found ?? BUILT_IN_PRESETS[0]!
}

/** Flowtime: the break is a fifth of the study stretch, at least 5 and at most 20 min. */
export function flowBreakMin(workMs: number): number {
  return Math.min(20, Math.max(5, Math.round(workMs / MINUTE / 5)))
}

/** Stretches of work: segments joined by unit switches (gap ≤ 2 s); each pause ends one. */
function stretches(list: Segment[]): { start: Date; end: Date | null; ms: number }[] {
  const out: { start: Date; end: Date | null; ms: number }[] = []
  for (const s of list) {
    const last = out[out.length - 1]
    const joined = last?.end && s.startedAt.getTime() - last.end.getTime() <= SWITCH_GAP_MS
    const ms = s.endedAt ? s.endedAt.getTime() - s.startedAt.getTime() : 0
    if (last && joined) {
      last.end = s.endedAt
      last.ms += ms
    } else out.push({ start: s.startedAt, end: s.endedAt, ms })
  }
  return out
}

const workSteps = (p: Extract<Preset, { kind: 'cycle' }>) =>
  p.steps.filter((s) => s.kind === 'work')

/** Study minutes of the n-th interval (0-based) of a cycle preset. */
export function workMinAt(p: Extract<Preset, { kind: 'cycle' }>, n: number): number {
  const work = workSteps(p)
  return work[n % work.length]!.min
}

/** Break after the n-th study interval (0-based): the long break on every `every`-th one. */
export function breakMinAfter(p: Extract<Preset, { kind: 'cycle' }>, n: number): number {
  if (p.longBreak && (n + 1) % p.longBreak.every === 0) return p.longBreak.min
  const k = n % workSteps(p).length
  let seen = -1
  const i = p.steps.findIndex((s) => s.kind === 'work' && ++seen === k)
  const next = p.steps[i + 1]
  return next?.kind === 'break' ? next.min : 0
}

export interface IntervalReminder {
  /** `work`: counting down to a break; `break`: counting down to getting back to work. */
  phase: 'work' | 'break'
  /** ms left in the phase; ≤ 0 = the phase is over ("Vrijeme je za pauzu" / "Vrijeme je za nastavak"). */
  remainingMs: number
  /** Length of the phase, for a progress ring. */
  totalMs: number
  /** The long break of a cycle preset. */
  long?: boolean
}

/**
 * The badge in a session. A cycle preset counts the current study interval from the start of
 * the stretch and the break from the last segment end; the n-th stretch is the n-th interval of
 * the cycle. Flowtime only counts breaks (a fifth of the stretch before it); free has none.
 */
export function presetReminder(
  preset: Preset,
  segments: Segment[],
  now: Date,
): IntervalReminder | null {
  if (preset.kind === 'free' || segments.length === 0) return null
  const list = stretches(sorted(segments))
  const last = list[list.length - 1]!
  if (last.end === null) {
    if (preset.kind === 'flow') return null
    const totalMs = workMinAt(preset, list.length - 1) * MINUTE
    return { phase: 'work', totalMs, remainingMs: totalMs - (now.getTime() - last.start.getTime()) }
  }
  const n = list.length - 1
  const min = preset.kind === 'flow' ? flowBreakMin(last.ms) : breakMinAfter(preset, n)
  const totalMs = min * MINUTE
  const long =
    preset.kind === 'cycle' && Boolean(preset.longBreak) && (n + 1) % preset.longBreak!.every === 0
  return {
    phase: 'break',
    totalMs,
    remainingMs: totalMs - (now.getTime() - last.end.getTime()),
    ...(long ? { long } : {}),
  }
}

/** When the break that starts now ends (`study_sessions.break_ends_at`); null without one. */
export function breakEndsAt(preset: Preset, pausedSegments: Segment[], now: Date): Date | null {
  const r = presetReminder(preset, pausedSegments, now)
  return r && r.phase === 'break' ? new Date(now.getTime() + r.remainingMs) : null
}

/**
 * Study interval the plan aligns blocks to (PRD "Hitnost": 50 + 50, not 70). Flowtime and free
 * have no fixed interval, so the plan uses Standardno's 50 min.
 */
export function planIntervalMin(preset: Preset): number {
  return preset.kind === 'cycle' ? workMinAt(preset, 0) : 50
}

/**
 * Breaks inside one block of `studyMin` minutes (the plan reserves them, PRD "Lista vs
 * satnica"): one after every full interval that is followed by more study. Flowtime reserves a
 * fifth per 50 min, free reserves nothing.
 */
export function breaksWithin(preset: Preset, studyMin: number): number[] {
  if (preset.kind === 'free') return []
  const out: number[] = []
  let left = studyMin
  for (let n = 0; ; n++) {
    const work = preset.kind === 'cycle' ? workMinAt(preset, n) : 50
    if (left <= work) return out
    left -= work
    out.push(preset.kind === 'cycle' ? breakMinAfter(preset, n) : flowBreakMin(work * MINUTE))
  }
}

/** The break the plan leaves after a block, before the next one. */
export function breakAfterBlock(preset: Preset, studyMin: number): number {
  if (preset.kind === 'free') return 0
  if (preset.kind === 'flow') return flowBreakMin(studyMin * MINUTE)
  return breakMinAfter(preset, breaksWithin(preset, studyMin).length)
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
