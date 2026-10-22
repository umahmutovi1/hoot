// iCal (ICS) parsing for `sync-calendar` (PRD "Povezani kalendari i integracije"): events of a
// feed expanded over a horizon, with RRULE, EXDATE and RECURRENCE-ID overrides. Free
// (TRANSP:TRANSPARENT) and cancelled events are dropped. Pure, so Vitest runs it on fixtures.
import ICAL from 'ical.js'

export interface IcsEvent {
  uid: string
  /** Timed: the instant. All-day: UTC midnight of the first date. */
  startsAt: Date
  /** Timed: the instant. All-day: UTC midnight after the last date (exclusive). */
  endsAt: Date
  allDay: boolean
  title: string | null
  location: string | null
}

export interface IcsOptions {
  from: Date
  to: Date
  /** Zone for floating times and unknown TZIDs (`profiles.timezone`). */
  timeZone: string
}

/** Occurrences per recurring event, a guard against endless or minutely rules. */
const MAX_OCCURRENCES = 1000

export class IcsError extends Error {
  code: 'not_ics' | 'parse_failed'
  constructor(code: 'not_ics' | 'parse_failed') {
    super(code)
    this.code = code
  }
}

/** Wall-clock fields in a zone → instant (Intl only, as in src/lib/day.ts). */
function zoned(fields: number[], timeZone: string): Date {
  const [y, mo, d, h, mi, s] = fields as [number, number, number, number, number, number]
  const wall = Date.UTC(y, mo - 1, d, h, mi, s)
  const offset = (at: number) => {
    const parts: Record<string, number> = {}
    for (const p of new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(new Date(at)))
      if (p.type !== 'literal') parts[p.type] = Number(p.value)
    return (
      Date.UTC(
        parts.year!,
        parts.month! - 1,
        parts.day!,
        parts.hour! % 24,
        parts.minute!,
        parts.second!,
      ) -
      Math.floor(at / 1000) * 1000
    )
  }
  let guess = wall - offset(wall)
  guess = wall - offset(guess)
  return new Date(guess)
}

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** An ICAL.Time as an instant: UTC, a zone defined in the feed, an IANA TZID, or floating. */
function instant(time: ICAL.Time, fallbackTz: string): Date {
  if (time.isDate) return new Date(Date.UTC(time.year, time.month - 1, time.day))
  const fields = [time.year, time.month, time.day, time.hour, time.minute, time.second]
  const zone = time.zone
  if (zone === ICAL.Timezone.utcTimezone)
    return new Date(
      Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second),
    )
  if (zone && zone !== ICAL.Timezone.localTimezone && zone.component) return time.toJSDate()
  // A TZID without a VTIMEZONE in the feed stays as a plain string (not in ical.js typings).
  const tzid = (time as unknown as { timezone?: string }).timezone
  return zoned(fields, tzid && validZone(tzid) ? tzid : fallbackTz)
}

const text = (c: ICAL.Component, name: string): string | null => {
  const v = c.getFirstPropertyValue(name)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Free or cancelled events never block time. */
function skipped(c: ICAL.Component): boolean {
  return (
    text(c, 'status')?.toUpperCase() === 'CANCELLED' ||
    text(c, 'transp')?.toUpperCase() === 'TRANSPARENT'
  )
}

function toEvent(
  uid: string,
  item: ICAL.Component,
  start: ICAL.Time,
  end: ICAL.Time | null,
  tz: string,
): IcsEvent {
  const allDay = start.isDate
  const startsAt = instant(start, tz)
  let endsAt = end ? instant(end, tz) : startsAt
  // An all-day event without DTEND lasts one day.
  if (allDay && endsAt.getTime() <= startsAt.getTime())
    endsAt = new Date(startsAt.getTime() + 86_400_000)
  if (endsAt.getTime() < startsAt.getTime()) endsAt = startsAt
  return {
    uid,
    startsAt,
    endsAt,
    allDay,
    title: text(item, 'summary'),
    location: text(item, 'location'),
  }
}

const overlaps = (e: IcsEvent, o: IcsOptions) =>
  e.endsAt.getTime() > o.from.getTime() && e.startsAt.getTime() < o.to.getTime()

/** Events of an ICS text that overlap [from, to), by start. */
export function parseIcs(ics: string, options: IcsOptions): IcsEvent[] {
  if (!/BEGIN:VCALENDAR/i.test(ics)) throw new IcsError('not_ics')
  let root: ICAL.Component
  try {
    root = new ICAL.Component(ICAL.parse(ics))
  } catch {
    throw new IcsError('parse_failed')
  }
  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    const tz = new ICAL.Timezone(vtz)
    if (tz.tzid && !ICAL.TimezoneService.has(tz.tzid)) ICAL.TimezoneService.register(tz)
  }

  // Masters and their RECURRENCE-ID overrides, by UID.
  const byUid = new Map<string, { master?: ICAL.Component; overrides: ICAL.Component[] }>()
  for (const c of root.getAllSubcomponents('vevent')) {
    const uid = text(c, 'uid')
    if (!uid) continue
    const entry = byUid.get(uid) ?? { overrides: [] }
    if (c.hasProperty('recurrence-id')) entry.overrides.push(c)
    else entry.master = c
    byUid.set(uid, entry)
  }

  const out: IcsEvent[] = []
  const tz = options.timeZone
  const horizon = ICAL.Time.fromJSDate(options.to, true)
  for (const [uid, { master, overrides }] of byUid) {
    if (!master) {
      // Overrides whose series is not in the feed: plain events.
      for (const o of overrides) {
        if (skipped(o)) continue
        const ev = new ICAL.Event(o)
        const e = toEvent(uid, o, ev.startDate, ev.endDate, tz)
        if (overlaps(e, options)) out.push(e)
      }
      continue
    }
    const event = new ICAL.Event(master)
    for (const o of overrides) event.relateException(o)
    if (!event.startDate) continue
    if (!event.isRecurring()) {
      if (skipped(master)) continue
      const e = toEvent(uid, master, event.startDate, event.endDate, tz)
      if (overlaps(e, options)) out.push(e)
      continue
    }
    const it = event.iterator()
    for (let n = 0, next = it.next(); next && n < MAX_OCCURRENCES; n++, next = it.next()) {
      const details = event.getOccurrenceDetails(next)
      const item = details.item.component
      if (details.startDate.compare(horizon) > 0 && next.compare(horizon) > 0) break
      if (skipped(item)) continue
      const e = toEvent(uid, item, details.startDate, details.endDate, tz)
      if (overlaps(e, options)) out.push(e)
    }
  }
  return out.sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.uid.localeCompare(b.uid),
  )
}
