import { wallClock } from '@/lib/day'

/** What an event from a connected calendar is (docs/CALENDAR-SYNC.md "Klasifikacija"). */
export type EventKind = 'busy' | 'lecture' | 'exam' | 'deadline' | 'free'

export const EVENT_KINDS: readonly EventKind[] = ['busy', 'lecture', 'exam', 'deadline', 'free']

/** Kinds that take study time; a deadline or a free event does not. */
export const BLOCKING_KINDS: ReadonlySet<EventKind> = new Set(['busy', 'lecture', 'exam'])

export interface ClassifiedEvent {
  id: string
  title: string | null
  startsAt: Date
  endsAt: Date
  allDay: boolean
}

export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const words = (title: string) => fold(title).split(' ').filter(Boolean)

const EXAM = ['ispit', 'kolokvij', 'parcijal', 'integraln', 'exam', 'midterm']
const DEADLINE = ['predaj', 'zadac', 'seminarsk', 'deadline', 'submission']
const DEADLINE_WORDS = new Set(['rok', 'roka', 'due'])
const LECTURE = ['predavanj', 'vjezb', 'vezb', 'lab', 'lecture', 'tutorial', 'exercise']
const LECTURE_WORDS = new Set(['seminar'])

const hasPrefix = (tokens: string[], prefixes: string[]) =>
  tokens.some((w) => prefixes.some((p) => w.startsWith(p)))

/**
 * Events of a weekly series: the same title at the same weekday and local start, three or more
 * times (a lecture is weekly; a one-off meeting is not).
 */
export function weeklySeries(events: ClassifiedEvent[], timeZone: string): Set<string> {
  const groups = new Map<string, string[]>()
  for (const e of events) {
    if (e.allDay || !e.title) continue
    const w = wallClock(e.startsAt, timeZone)
    const weekday = new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay()
    const key = `${fold(e.title)}|${weekday}|${w.minutes}`
    groups.set(key, [...(groups.get(key) ?? []), e.id])
  }
  const series = new Set<string>()
  for (const ids of groups.values()) if (ids.length >= 3) for (const id of ids) series.add(id)
  return series
}

/** Does the title name one of the subjects (its whole name, or its first long word)? */
function namesSubject(tokens: string[], subjectNames: string[]): boolean {
  const title = ` ${tokens.join(' ')} `
  return subjectNames.some((name) => {
    const folded = fold(name)
    if (folded && title.includes(` ${folded} `)) return true
    const first = folded.split(' ').find((w) => w.length >= 5)
    return first !== undefined && tokens.some((w) => w.startsWith(first.slice(0, 6)))
  })
}

/**
 * The kind by rules, first match wins; null when the rules cannot tell (the AI decides, until
 * then the event counts as busy). Deadline feeds (Moodle) are deadlines; a timed event without
 * duration is a due date; keywords (bs/en, without diacritics) name exams and deadlines; a weekly
 * series that names a subject, or a lecture word, is a lecture; no title (busy only) is busy.
 */
export function ruleKind(
  event: ClassifiedEvent,
  ctx: { deadlineFeed: boolean; inSeries: boolean; subjectNames: string[] },
): EventKind | null {
  if (ctx.deadlineFeed) return 'deadline'
  const minutes = (event.endsAt.getTime() - event.startsAt.getTime()) / 60_000
  if (!event.allDay && minutes < 5) return 'deadline'
  if (!event.title?.trim()) return 'busy'
  const tokens = words(event.title)
  if (hasPrefix(tokens, EXAM)) return 'exam'
  if (tokens.some((w) => DEADLINE_WORDS.has(w)) || hasPrefix(tokens, DEADLINE)) return 'deadline'
  if (hasPrefix(tokens, LECTURE) || tokens.some((w) => LECTURE_WORDS.has(w))) return 'lecture'
  if (ctx.inSeries && namesSubject(tokens, ctx.subjectNames)) return 'lecture'
  // All-day events without a keyword (birthdays, trips): busy only when the feed says so.
  if (event.allDay) return 'busy'
  return null
}
