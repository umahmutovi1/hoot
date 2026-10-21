import { wallClock, zonedInstant, type LocalDate } from '@/lib/day'
import type { SegmentRow } from './model'

/** A segment as the history editor shows it: wall-clock times on the session's calendar date. */
export interface SegmentDraft {
  id: string
  unitId: string | null
  start: string
  end: string
}

export type DraftError = 'empty' | 'time' | 'overlap'

/** "HH:mm" of an instant in the user's zone. */
export function hhmm(instant: Date, timeZone: string): string {
  const m = wallClock(instant, timeZone).minutes
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function minutesOf(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h < 24 && min < 60 ? h * 60 + min : null
}

export function toDrafts(segments: SegmentRow[], timeZone: string): SegmentDraft[] {
  return [...segments]
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map((s) => ({
      id: s.id,
      unitId: s.unit_id,
      start: hhmm(new Date(s.started_at), timeZone),
      end: hhmm(new Date(s.ended_at ?? s.started_at), timeZone),
    }))
}

/**
 * Drafts back to segments on `date` (the calendar date of the first segment). A start far before
 * the previous end, or an end before its start, crosses midnight.
 */
export function fromDrafts(
  drafts: SegmentDraft[],
  date: LocalDate,
  timeZone: string,
  sessionId: string,
  original: SegmentRow[] = [],
): { segments: SegmentRow[] } | { error: DraftError } {
  if (drafts.length === 0) return { error: 'empty' }
  const segments: SegmentRow[] = []
  let dayOffset = 0
  let last = -1
  for (const d of drafts) {
    const start = minutesOf(d.start)
    const end = minutesOf(d.end)
    if (start === null || end === null) return { error: 'time' }
    let s = start + dayOffset
    // A big step back is the next day (23:30 → 00:30); a small one is an overlap.
    if (last - s > 720) {
      dayOffset += 1440
      s += 1440
    }
    let e = end + dayOffset
    if (e < s) e += 1440
    last = e
    // A time the user did not touch keeps its seconds (short segments stay as measured).
    const before = original.find((o) => o.id === d.id)
    const keep = (iso: string | null | undefined, time: string) =>
      iso && hhmm(new Date(iso), timeZone) === time ? new Date(iso).toISOString() : null
    segments.push({
      id: d.id,
      session_id: sessionId,
      unit_id: d.unitId,
      started_at:
        keep(before?.started_at, d.start) ?? zonedInstant(date, s, timeZone).toISOString(),
      ended_at: keep(before?.ended_at, d.end) ?? zonedInstant(date, e, timeZone).toISOString(),
    })
  }
  for (const x of segments) if (x.ended_at! < x.started_at) return { error: 'time' }
  for (let i = 1; i < segments.length; i++)
    if (segments[i]!.started_at < segments[i - 1]!.ended_at!) return { error: 'overlap' }
  return { segments }
}
