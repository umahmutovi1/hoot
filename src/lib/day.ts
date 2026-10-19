/**
 * Day boundary (PRD "Granica dana"): a "day" starts at `profiles.day_start_min` (default 04:00)
 * in `profiles.timezone`, so studying at 01:30 belongs to the previous day. Every `on_date`
 * column is a local date (`yyyy-MM-dd`) computed here; timestamps stay UTC.
 *
 * Uses Intl only (no tz library). Wall-clock minutes are read in the zone, so DST nights do
 * not shift the boundary by an hour.
 */

export interface DayBoundary {
  timeZone: string
  /** Minutes after local midnight when the day starts (240 = 04:00). */
  dayStartMin: number
}

export const DEFAULT_BOUNDARY: DayBoundary = { timeZone: 'Europe/Sarajevo', dayStartMin: 240 }

/** `yyyy-MM-dd` */
export type LocalDate = string

interface WallClock {
  year: number
  month: number
  day: number
  /** Minutes after local midnight. */
  minutes: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, f)
  }
  return f
}

/** Wall clock of an instant in a time zone. */
export function wallClock(instant: Date, timeZone: string): WallClock {
  const parts: Record<string, number> = {}
  for (const p of formatter(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value)
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    minutes: (parts.hour! % 24) * 60 + parts.minute!,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toLocalDate(year: number, month: number, day: number): LocalDate {
  return `${year}-${pad(month)}-${pad(day)}`
}

function parse(date: LocalDate): [number, number, number] {
  const [y = NaN, m = NaN, d = NaN] = date.split('-').map(Number)
  return [y, m, d]
}

/** The local day an instant belongs to, respecting the day boundary. */
export function localDay(instant: Date, boundary: DayBoundary = DEFAULT_BOUNDARY): LocalDate {
  const w = wallClock(instant, boundary.timeZone)
  const date = toLocalDate(w.year, w.month, w.day)
  return w.minutes < boundary.dayStartMin ? addDays(date, -1) : date
}

/** Minutes since the start of the local day (0 at the boundary, e.g. 04:00). */
export function minutesIntoDay(instant: Date, boundary: DayBoundary = DEFAULT_BOUNDARY): number {
  const w = wallClock(instant, boundary.timeZone)
  return (w.minutes - boundary.dayStartMin + 1440) % 1440
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = parse(date)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return toLocalDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = parse(a)
  const [by, bm, bd] = parse(b)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** 0 = Monday … 6 = Sunday, as in `timetable_entries.weekday`. */
export function weekdayOf(date: LocalDate): number {
  const [y, m, d] = parse(date)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** Monday of the week the date is in. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -weekdayOf(date))
}

/** Offset of the zone from UTC at an instant, in minutes (Sarajevo summer = 120). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day) + w.minutes * 60_000
  const instantMinute = Math.floor(instant.getTime() / 60_000) * 60_000
  return Math.round((asUtc - instantMinute) / 60_000)
}

/**
 * The instant of a wall-clock time on a calendar date in a zone (e.g. a class at 09:00).
 * `minutes` may exceed 1440 for times after midnight. A time skipped by DST moves forward.
 */
export function zonedInstant(date: LocalDate, minutes: number, timeZone: string): Date {
  const [y, m, d] = parse(date)
  const wall = Date.UTC(y, m - 1, d) + minutes * 60_000
  let guess = wall - offsetMinutes(new Date(wall), timeZone) * 60_000
  guess = wall - offsetMinutes(new Date(guess), timeZone) * 60_000
  return new Date(guess)
}

/** When a local day starts (its boundary, e.g. 04:00 that morning). */
export function dayStartInstant(date: LocalDate, boundary: DayBoundary = DEFAULT_BOUNDARY): Date {
  return zonedInstant(date, boundary.dayStartMin, boundary.timeZone)
}

/** `Date` at local noon of a calendar date in the browser zone, for date-fns formatting. */
export function toDisplayDate(date: LocalDate): Date {
  const [y, m, d] = parse(date)
  return new Date(y, m - 1, d, 12)
}
