import { itemHash, type CalendarItem } from '@shared/calendarSync.ts'

/** Blocks and classes go into Google this many days ahead; exams and deadlines all of them. */
export const PUSH_HORIZON_DAYS = 14
/** A deadline in Google: the last 15 minutes before it is due. */
const DEADLINE_MINUTES = 15

export interface BlockInput {
  id: string
  start: Date
  minutes: number
  title: string
  description: string | null
  color: string | null
}

export interface ExamInput {
  id: string
  subjectId: string
  /** First possible day (local date) and the last one for a tentative date. */
  from: string
  to: string
  title: string
  color: string | null
}

export interface DeadlineInput {
  id: string
  subjectId: string | null
  due: Date
  title: string
  color: string | null
}

export interface ClassInput {
  entryId: string
  date: string
  start: Date
  end: Date
  title: string
  location: string | null
  color: string | null
}

const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

function withHash(item: Omit<CalendarItem, 'hash'>): CalendarItem {
  return { ...item, hash: itemHash(item) }
}

/**
 * What Hoot wants in its Google calendar (docs/CALENDAR-SYNC.md): planned blocks with a time
 * (with the "Započni" link), exams (all-day, a tentative date over its range), deadlines and
 * classes. Pure: the caller picks what is in the horizon and writes the labels in the user's
 * language; keys are stable so the server can patch events instead of recreating them.
 */
export function calendarItems(input: {
  blocks: BlockInput[]
  exams: ExamInput[]
  deadlines: DeadlineInput[]
  classes: ClassInput[]
}): CalendarItem[] {
  const items: CalendarItem[] = []
  for (const b of input.blocks)
    items.push(
      withHash({
        key: `block:${b.id}`,
        kind: 'block',
        ref_id: b.id,
        starts_at: b.start.toISOString(),
        ends_at: new Date(b.start.getTime() + b.minutes * 60_000).toISOString(),
        all_day: false,
        title: b.title,
        description: b.description,
        url_path: `/?block=${b.id}`,
        color: b.color,
      }),
    )
  for (const e of input.exams)
    items.push(
      withHash({
        key: `exam:${e.id}`,
        kind: 'exam',
        ref_id: e.id,
        starts_at: `${e.from}T00:00:00.000Z`,
        ends_at: nextDay(e.to),
        all_day: true,
        title: e.title,
        description: null,
        url_path: `/subjects/${e.subjectId}`,
        color: e.color,
      }),
    )
  for (const d of input.deadlines)
    items.push(
      withHash({
        key: `deadline:${d.id}`,
        kind: 'deadline',
        ref_id: d.id,
        // A short event ending at the due time: Google's end is exclusive, so zero length is empty.
        starts_at: new Date(d.due.getTime() - DEADLINE_MINUTES * 60_000).toISOString(),
        ends_at: d.due.toISOString(),
        all_day: false,
        title: d.title,
        description: null,
        url_path: d.subjectId ? `/subjects/${d.subjectId}` : null,
        color: d.color,
      }),
    )
  for (const c of input.classes)
    items.push(
      withHash({
        key: `class:${c.entryId}:${c.date}`,
        kind: 'class',
        ref_id: c.entryId,
        starts_at: c.start.toISOString(),
        ends_at: c.end.toISOString(),
        all_day: false,
        title: c.title,
        description: c.location,
        url_path: null,
        color: c.color,
      }),
    )
  return items
}

/**
 * Rows to write and keys to delete so `calendar_items` matches the wanted items. Stored items that
 * started before `keepBefore` (today's start) stay: past events are history in Google, and the
 * app no longer lists them.
 */
export function diffItems(
  wanted: CalendarItem[],
  stored: Pick<CalendarItem, 'key' | 'hash' | 'starts_at'>[],
  keepBefore: Date,
): { upsert: CalendarItem[]; remove: string[] } {
  const have = new Map(stored.map((s) => [s.key, s.hash]))
  const keys = new Set(wanted.map((w) => w.key))
  return {
    upsert: wanted.filter((w) => have.get(w.key) !== w.hash),
    remove: stored
      .filter((s) => !keys.has(s.key) && Date.parse(s.starts_at) >= keepBefore.getTime())
      .map((s) => s.key),
  }
}
