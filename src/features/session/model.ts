import type { Tables } from '@/types/database'
import type { StudyMode } from '@/lib/estimates/calibration'
import type { TFunction } from 'i18next'
import { activeMs, MINUTE, type Preset, type Segment } from '@/lib/session/timer'

/** Session and segment rows as the queue and the mirror keep them (no `user_id`, RLS fills it). */
export type SessionRow = Omit<Tables<'study_sessions'>, 'user_id' | 'created_at'>
export type SegmentRow = Omit<Tables<'study_segments'>, 'user_id'>

export interface ActiveSession {
  session: SessionRow
  segments: SegmentRow[]
}

export const STUDY_MODES: StudyMode[] = ['reading', 'problems', 'review', 'questions']

/** The fixed modes the session timer sheet offers until preset pickers arrive with 0014. */
export const STAGE7_MODES = ['pomodoro25', 'pomodoro50', 'free'] as const

/** Display name of a preset: its own for custom ones, the i18n name for built-ins. */
export function presetName(t: TFunction, preset: Preset): string {
  if (preset.kind === 'cycle' && preset.name) return preset.name
  return t(`session.preset.${preset.id as BuiltInPresetId}`)
}

type BuiltInPresetId = 'standard' | 'pomodoro' | 'flow' | 'free' | 'pomodoro25' | 'pomodoro50'

export function toSegment(row: SegmentRow): Segment {
  return {
    id: row.id,
    unitId: row.unit_id,
    startedAt: new Date(row.started_at),
    endedAt: row.ended_at ? new Date(row.ended_at) : null,
  }
}

export function bySegmentStart(a: SegmentRow, b: SegmentRow) {
  return a.started_at.localeCompare(b.started_at)
}

/** The unit of the last segment: what "Sad radim na" shows as active. */
export function currentUnitId(segments: SegmentRow[]): string | null {
  const last = [...segments].sort(bySegmentStart).at(-1)
  return last?.unit_id ?? null
}

/** "23:41", "1:05:09" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** "HH:mm" on the day the segment started (next day if earlier), kept between start and now. */
export function endAt(start: Date, time: string, now: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!m) return null
  const at = new Date(start)
  at.setHours(Number(m[1]), Number(m[2]), 0, 0)
  // Same minute as the start counts as the start.
  while (at.getTime() < start.getTime() - 59_999) at.setDate(at.getDate() + 1)
  if (at.getTime() > now.getTime()) return null
  return new Date(Math.max(at.getTime(), start.getTime()))
}

/** Studied minutes of a finished session. */
export function sessionMinutes(s: SessionRow & { study_segments: SegmentRow[] }): number {
  return activeMs(s.study_segments.map(toSegment), new Date(s.ended_at!)) / MINUTE
}
