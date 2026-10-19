import { addDays, diffDays, startOfWeek, weekdayOf, type LocalDate } from '@/lib/day'

/**
 * Academic calendar, timetable and availability (PRD "Akademski kalendar", "Raspored nastave").
 * Times are wall-clock minutes after local midnight on a calendar date; slots never cross
 * midnight (the DB checks end_min > start_min).
 */

export type PeriodKind = 'teaching' | 'partial_exams' | 'exam' | 'holiday'
export type ExamSession = 'regular' | 'makeup'

export interface Period {
  id: string
  kind: PeriodKind
  examSession: ExamSession | null
  title: string
  startsOn: LocalDate
  endsOn: LocalDate
}

export type WeekParity = 'odd' | 'even'

export interface ClassEntry {
  id: string
  subjectId: string | null
  kind: 'lecture' | 'exercise' | 'lab' | 'other'
  /** 0 = Monday */
  weekday: number
  startMin: number
  endMin: number
  weekParity: WeekParity | null
  validFrom: LocalDate
  validTo: LocalDate
}

export interface Slot {
  startMin: number
  endMin: number
}

export interface AvailabilityRule extends Slot {
  weekday: number
}

export interface AvailabilityException {
  onDate: LocalDate
  /** null with endMin null = the whole day */
  startMin: number | null
  endMin: number | null
  isBusy: boolean
}

/** Minutes before and after a class that are busy too (getting there and back). */
export const CLASS_MARGIN_MIN = 15
export const DAY_MINUTES = 1440

export const within = (date: LocalDate, from: LocalDate, to: LocalDate) =>
  date >= from && date <= to

export function periodsOn(date: LocalDate, periods: Period[]): Period[] {
  return periods.filter((p) => within(date, p.startsOn, p.endsOn))
}

/** 1-based week of `date` counted from the week (Mon–Sun) that contains `start`. */
export function weekNumber(start: LocalDate, date: LocalDate): number {
  return Math.floor(diffDays(startOfWeek(start), date) / 7) + 1
}

/** Odd weeks are 1, 3, 5… counted from the start of the teaching period. */
export function parityOf(start: LocalDate, date: LocalDate): WeekParity {
  return weekNumber(start, date) % 2 === 1 ? 'odd' : 'even'
}

export type CalendarStatus =
  | { kind: 'holiday'; title: string }
  | { kind: 'partial_exams'; title: string }
  | { kind: 'exam'; title: string; week: number }
  | { kind: 'teaching'; title: string; week: number }

/**
 * What the academic calendar says about a day, for the line under the date on Today.
 * A holiday wins, then partial-exam weeks, exam periods and teaching.
 */
export function calendarStatus(date: LocalDate, periods: Period[]): CalendarStatus | null {
  const on = periodsOn(date, periods)
  const first = (kind: PeriodKind) =>
    on.filter((p) => p.kind === kind).sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0]
  const holiday = first('holiday')
  if (holiday) return { kind: 'holiday', title: holiday.title }
  const partial = first('partial_exams')
  if (partial) return { kind: 'partial_exams', title: partial.title }
  const exam = first('exam')
  if (exam) return { kind: 'exam', title: exam.title, week: weekNumber(exam.startsOn, date) }
  const teaching = first('teaching')
  if (teaching)
    return {
      kind: 'teaching',
      title: teaching.title,
      week: weekNumber(teaching.startsOn, date),
    }
  return null
}

export function isHoliday(date: LocalDate, periods: Period[]): boolean {
  return periodsOn(date, periods).some((p) => p.kind === 'holiday')
}

/** Does the class take place on this date (period, weekday, odd/even week, not a holiday)? */
export function classOccursOn(entry: ClassEntry, date: LocalDate, periods: Period[]): boolean {
  if (!within(date, entry.validFrom, entry.validTo)) return false
  if (weekdayOf(date) !== entry.weekday) return false
  if (entry.weekParity && parityOf(entry.validFrom, date) !== entry.weekParity) return false
  return !isHoliday(date, periods)
}

/** Classes on a date, by start time. */
export function classesOn<T extends ClassEntry>(
  date: LocalDate,
  entries: T[],
  periods: Period[],
): T[] {
  return entries
    .filter((e) => classOccursOn(e, date, periods))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
}

/** Sorted, non-overlapping slots; touching slots are joined. */
export function mergeSlots(slots: Slot[]): Slot[] {
  const sorted = slots
    .map((s) => ({
      startMin: Math.max(0, s.startMin),
      endMin: Math.min(DAY_MINUTES, s.endMin),
    }))
    .filter((s) => s.endMin > s.startMin)
    .sort((a, b) => a.startMin - b.startMin)
  const out: Slot[] = []
  for (const s of sorted) {
    const last = out[out.length - 1]
    if (last && s.startMin <= last.endMin) last.endMin = Math.max(last.endMin, s.endMin)
    else out.push({ ...s })
  }
  return out
}

/** `free` minus `busy`. */
export function subtractSlots(free: Slot[], busy: Slot[]): Slot[] {
  let out = mergeSlots(free)
  for (const b of mergeSlots(busy)) {
    out = out.flatMap((s) => {
      if (b.endMin <= s.startMin || b.startMin >= s.endMin) return [s]
      const parts: Slot[] = []
      if (b.startMin > s.startMin) parts.push({ startMin: s.startMin, endMin: b.startMin })
      if (b.endMin < s.endMin) parts.push({ startMin: b.endMin, endMin: s.endMin })
      return parts
    })
  }
  return out
}

export function slotMinutes(slots: Slot[]): number {
  return mergeSlots(slots).reduce((sum, s) => sum + s.endMin - s.startMin, 0)
}

/** A class plus the margin before and after it. */
export function busySlotOf(entry: Slot): Slot {
  return { startMin: entry.startMin - CLASS_MARGIN_MIN, endMin: entry.endMin + CLASS_MARGIN_MIN }
}

const exceptionSlot = (e: AvailabilityException): Slot =>
  e.startMin === null || e.endMin === null
    ? { startMin: 0, endMin: DAY_MINUTES }
    : { startMin: e.startMin, endMin: e.endMin }

export interface DayInput {
  rules: AvailabilityRule[]
  exceptions: AvailabilityException[]
  entries: ClassEntry[]
  periods: Period[]
  /** Timetable entries cancelled on this date ("Nastava otkazana"). */
  cancelledEntryIds?: ReadonlySet<string>
}

/**
 * Free study time on a date (PRD "Scheduler" step 1): weekly rules plus extra free time,
 * minus busy exceptions (a whole-day one leaves nothing), minus classes ±15 min that are not
 * cancelled.
 */
export function freeSlotsOn(date: LocalDate, input: DayInput): Slot[] {
  const exceptions = input.exceptions.filter((e) => e.onDate === date)
  const base = [
    ...input.rules.filter((r) => r.weekday === weekdayOf(date)),
    ...exceptions.filter((e) => !e.isBusy).map(exceptionSlot),
  ]
  const busy = exceptions.filter((e) => e.isBusy).map(exceptionSlot)
  const classes = classesOn(date, input.entries, input.periods)
    .filter((e) => !input.cancelledEntryIds?.has(e.id))
    .map(busySlotOf)
  return subtractSlots(base, [...busy, ...classes])
}

export function freeMinutesOn(date: LocalDate, input: DayInput): number {
  return slotMinutes(freeSlotsOn(date, input))
}

/** Net free minutes in the week (Mon–Sun) that contains `date`. */
export function weekFreeMinutes(date: LocalDate, input: DayInput): number {
  const monday = startOfWeek(date)
  let total = 0
  for (let i = 0; i < 7; i++) total += freeMinutesOn(addDays(monday, i), input)
  return total
}

/** How a single exception changes the day compared with the weekly rules (+ / − minutes). */
export function exceptionDelta(
  exception: AvailabilityException,
  input: Omit<DayInput, 'exceptions'>,
): number {
  const without = freeMinutesOn(exception.onDate, { ...input, exceptions: [] })
  const withIt = freeMinutesOn(exception.onDate, { ...input, exceptions: [exception] })
  return withIt - without
}

/** Classes in the teaching period that contains `date` (or the next one), per week. */
export function weeklyClassCount(entries: ClassEntry[]): number {
  return entries.reduce((n, e) => n + (e.weekParity ? 0.5 : 1), 0)
}

/** The teaching period covering the date, otherwise the next one, otherwise the last one. */
export function currentTeachingPeriod(date: LocalDate, periods: Period[]): Period | undefined {
  const teaching = periods
    .filter((p) => p.kind === 'teaching')
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  return (
    teaching.find((p) => within(date, p.startsOn, p.endsOn)) ??
    teaching.find((p) => p.startsOn > date) ??
    teaching[teaching.length - 1]
  )
}

/** "HH:mm" for minutes after midnight. */
export function formatClock(minutes: number): string {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** "HH:mm" → minutes after midnight; null when malformed. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null
  return h * 60 + m
}

export type ExamKind = 'partial' | 'final' | 'integral' | 'makeup' | 'other'

/** Periods an exam of this kind can be "in": partial-exam weeks or exam periods. */
export function examPeriodsFor(kind: ExamKind, periods: Period[]): Period[] {
  return periods
    .filter((p) => p.kind === 'exam' || p.kind === 'partial_exams')
    .sort((a, b) => {
      const fit = (p: Period) => (suits(kind, p) ? 0 : 1)
      return fit(a) - fit(b) || a.startsOn.localeCompare(b.startsOn)
    })
}

/** Partial → partial-exam week, makeup → makeup period, the rest → regular exam period. */
function suits(kind: ExamKind, p: Period): boolean {
  if (kind === 'partial') return p.kind === 'partial_exams'
  if (kind === 'makeup') return p.kind === 'exam' && p.examSession === 'makeup'
  return p.kind === 'exam' && p.examSession === 'regular'
}

/** Suggested period for a new exam with an unknown date: the next one that suits its kind. */
export function suggestExamPeriod(
  kind: ExamKind,
  periods: Period[],
  today: LocalDate,
): Period | undefined {
  return periods
    .filter((p) => suits(kind, p) && p.endsOn >= today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0]
}

/**
 * Periods for a subject's exams whose dates are not known yet ("uzmi rokove"): the n-th partial
 * gets the n-th upcoming partial-exam week, the rest the next period that suits their kind.
 */
export function assignExamPeriods(
  exams: { kind: ExamKind }[],
  periods: Period[],
  today: LocalDate,
): (Period | undefined)[] {
  const partialWeeks = periods
    .filter((p) => p.kind === 'partial_exams' && p.endsOn >= today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  let n = 0
  return exams.map((e) =>
    e.kind === 'partial' ? partialWeeks[n++] : suggestExamPeriod(e.kind, periods, today),
  )
}
