import { toLocalDate, wallClock, weekdayOf, type LocalDate } from '@/lib/day'
import { matchSubject, type ImportSubject } from '@/lib/import'
import { fold, type EventKind } from './classify'

// Lectures and exams that are both in a connected calendar and in Hoot (docs/CALENDAR-SYNC.md
// "Duplikati"): what to offer, and which events and Hoot items are already one thing.

export interface MatchEvent {
  id: string
  feedId: string
  uid: string
  title: string | null
  startsAt: Date
  endsAt: Date
  kind: EventKind
  inSeries: boolean
}

export type MatchDecision = 'linked' | 'distinct' | 'skipped' | 'hoot'

export interface MatchRow {
  feed_id: string
  match_key: string
  kind: string
  target_id: string | null
  decision: string
  seen_start: string | null
}

export interface MatchEntry {
  id: string
  subjectId: string | null
  weekday: number
  startMin: number
  endMin: number
}

export interface MatchExam {
  id: string
  subjectId: string
  at: string
}

export type ClassKind = 'lecture' | 'exercise' | 'lab' | 'other'

export interface LectureProposal {
  key: string
  feedId: string
  matchKey: string
  title: string
  weekday: number
  startMin: number
  endMin: number
  subjectId: string | null
  classKind: ClassKind
  /** `same`: a timetable entry at that weekday and time already exists. */
  status: 'new' | 'same'
  existingId: string | null
  /** Upcoming events of the series. */
  eventIds: string[]
}

export interface ExamProposal {
  key: string
  feedId: string
  matchKey: string
  eventId: string
  title: string
  startsAt: string
  subjectId: string | null
  /** `same`: an exam that day; `changed`: a linked exam moved in the calendar. */
  status: 'new' | 'same' | 'changed'
  existingId: string | null
  previousAt: string | null
}

const local = (instant: Date, timeZone: string) => {
  const w = wallClock(instant, timeZone)
  return { date: toLocalDate(w.year, w.month, w.day), minutes: w.minutes }
}

/** Key of a lecture series: the same title at the same weekday and local start. */
export function seriesKey(event: Pick<MatchEvent, 'title' | 'startsAt'>, timeZone: string) {
  const at = local(event.startsAt, timeZone)
  return `series:${fold(event.title ?? '')}|${weekdayOf(at.date)}|${at.minutes}`
}

/** Key of a single exam event: its uid, so a moved exam stays the same exam. */
export const examKey = (event: Pick<MatchEvent, 'uid'>) => `event:${event.uid}`

function classKindOf(title: string): ClassKind {
  const t = fold(title)
  if (/\b(vjezb|vezb|exercise|tutorial)/.test(t)) return 'exercise'
  if (/\blab/.test(t)) return 'lab'
  return 'lecture'
}

/**
 * The subject a title names: its whole name inside the title, else the longest subject whose first
 * long word starts a word of the title ("Kolokvij Fizika", "Mat. analiza"), else the closest name.
 */
export function subjectOf(title: string, subjects: readonly ImportSubject[]): string | null {
  const words = fold(title).split(' ')
  const padded = ` ${words.join(' ')} `
  const whole = subjects
    .filter((s) => fold(s.name) && padded.includes(` ${fold(s.name)} `))
    .sort((a, b) => b.name.length - a.name.length)[0]
  if (whole) return whole.id
  const byWord = subjects.find((s) => {
    const first = fold(s.name)
      .split(' ')
      .find((w) => w.length >= 5)
    return first !== undefined && words.some((w) => w.startsWith(first.slice(0, 6)))
  })
  return byWord?.id ?? matchSubject({ subject_id: null, subject_name: title }, subjects)
}

/**
 * What to offer from the calendars: upcoming lecture series (one row per series) and exams that
 * nobody decided about yet, each marked new or the same as a timetable entry or exam Hoot already
 * has; and linked exams whose date moved in the calendar.
 */
export function calendarProposals(input: {
  events: MatchEvent[]
  matches: MatchRow[]
  entries: MatchEntry[]
  exams: MatchExam[]
  subjects: readonly ImportSubject[]
  timeZone: string
  now: Date
}): { lectures: LectureProposal[]; exams: ExamProposal[] } {
  const decided = new Map(input.matches.map((m) => [`${m.feed_id}|${m.match_key}`, m]))
  const upcoming = input.events
    .filter((e) => e.endsAt.getTime() > input.now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

  const series = new Map<string, LectureProposal>()
  for (const e of upcoming) {
    if (e.kind !== 'lecture' || !e.inSeries || !e.title) continue
    const matchKey = seriesKey(e, input.timeZone)
    const key = `${e.feedId}|${matchKey}`
    if (decided.has(key)) continue
    const known = series.get(key)
    if (known) {
      known.eventIds.push(e.id)
      continue
    }
    const start = local(e.startsAt, input.timeZone)
    const weekday = weekdayOf(start.date)
    const minutes = Math.round((e.endsAt.getTime() - e.startsAt.getTime()) / 60_000)
    const subjectId = subjectOf(e.title, input.subjects)
    const existing = input.entries.find(
      (x) =>
        x.weekday === weekday &&
        Math.abs(x.startMin - start.minutes) <= 15 &&
        (subjectId === null || x.subjectId === null || x.subjectId === subjectId),
    )
    series.set(key, {
      key,
      feedId: e.feedId,
      matchKey,
      title: e.title,
      weekday,
      startMin: start.minutes,
      endMin: start.minutes + minutes,
      subjectId: subjectId ?? existing?.subjectId ?? null,
      classKind: classKindOf(e.title),
      status: existing ? 'same' : 'new',
      existingId: existing?.id ?? null,
      eventIds: [e.id],
    })
  }

  const exams: ExamProposal[] = []
  for (const e of upcoming) {
    if (e.kind !== 'exam' || !e.title) continue
    const matchKey = examKey(e)
    const key = `${e.feedId}|${matchKey}`
    const startsAt = e.startsAt.toISOString()
    const row = decided.get(key)
    const subjectId = subjectOf(e.title, input.subjects)
    if (row) {
      const target = input.exams.find((x) => x.id === row.target_id)
      const moved = row.seen_start !== null && Date.parse(row.seen_start) !== e.startsAt.getTime()
      if (row.decision === 'linked' && target && moved)
        exams.push({
          key,
          feedId: e.feedId,
          matchKey,
          eventId: e.id,
          title: e.title,
          startsAt,
          subjectId: target.subjectId,
          status: 'changed',
          existingId: target.id,
          previousAt: target.at,
        })
      continue
    }
    const day: LocalDate = local(e.startsAt, input.timeZone).date
    const existing = input.exams.find(
      (x) =>
        local(new Date(x.at), input.timeZone).date === day &&
        (subjectId === null || x.subjectId === subjectId),
    )
    exams.push({
      key,
      feedId: e.feedId,
      matchKey,
      eventId: e.id,
      title: e.title,
      startsAt,
      subjectId: subjectId ?? existing?.subjectId ?? null,
      status: existing ? 'same' : 'new',
      existingId: existing?.id ?? null,
      previousAt: existing?.at ?? null,
    })
  }
  return { lectures: [...series.values()], exams }
}

/**
 * Lecture events whose series is linked to a timetable entry: the class already takes the time,
 * so the event is not busy a second time.
 */
export function linkedLectureEvents(
  events: MatchEvent[],
  matches: MatchRow[],
  timeZone: string,
): Set<string> {
  const linked = new Set(
    matches
      .filter((m) => m.kind === 'lecture' && (m.decision === 'linked' || m.decision === 'hoot'))
      .map((m) => `${m.feed_id}|${m.match_key}`),
  )
  const out = new Set<string>()
  for (const e of events)
    if (e.title && linked.has(`${e.feedId}|${seriesKey(e, timeZone)}`)) out.add(e.id)
  return out
}

/** Hoot items already in the user's Google calendar: not written into Hoot's calendar again. */
export function inGoogleAlready(matches: MatchRow[], googleFeedIds: ReadonlySet<string>) {
  const entries = new Set<string>()
  const exams = new Set<string>()
  for (const m of matches) {
    if (m.decision !== 'linked' || !m.target_id || !googleFeedIds.has(m.feed_id)) continue
    if (m.kind === 'lecture') entries.add(m.target_id)
    else exams.add(m.target_id)
  }
  return { entries, exams }
}

export interface UnknownSeries {
  key: string
  feedId: string
  matchKey: string
  title: string
  weekday: number
  startMin: number
  endMin: number
  eventIds: string[]
}

/**
 * Upcoming weekly series counted as plain busy time that nobody decided about: maybe a lecture the
 * rules and the AI did not recognize ("Mat A2"). Asked once; "Nije predavanje" is remembered.
 */
export function unknownSeries(input: {
  events: MatchEvent[]
  matches: MatchRow[]
  timeZone: string
  now: Date
}): UnknownSeries[] {
  const decided = new Set(input.matches.map((m) => `${m.feed_id}|${m.match_key}`))
  const out = new Map<string, UnknownSeries>()
  for (const e of [...input.events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    if (e.kind !== 'busy' || !e.inSeries || !e.title) continue
    if (e.endsAt.getTime() <= input.now.getTime()) continue
    const matchKey = seriesKey(e, input.timeZone)
    const key = `${e.feedId}|${matchKey}`
    if (decided.has(key)) continue
    const known = out.get(key)
    if (known) {
      known.eventIds.push(e.id)
      continue
    }
    const start = local(e.startsAt, input.timeZone)
    out.set(key, {
      key,
      feedId: e.feedId,
      matchKey,
      title: e.title,
      weekday: weekdayOf(start.date),
      startMin: start.minutes,
      endMin: start.minutes + Math.round((e.endsAt.getTime() - e.startsAt.getTime()) / 60_000),
      eventIds: [e.id],
    })
  }
  return [...out.values()]
}
