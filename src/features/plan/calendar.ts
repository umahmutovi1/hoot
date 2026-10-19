import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { Assessment, Deadline, SubjectWithAssessments } from '@/features/subjects/model'

export interface CalendarCell {
  date: Date
  inMonth: boolean
}

/** Monday-first weeks covering the whole month, as in the Plan mockup. */
export function monthGrid(month: Date): CalendarCell[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const cells: CalendarCell[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    cells.push({ date: d, inMonth: isSameMonth(d, month) })
  }
  return cells
}

export interface DayExam {
  exam: Assessment
  subject: SubjectWithAssessments
}

const hasRange = (exam: Assessment) => exam.date_tentative && exam.at_latest !== null

function activeExams(subjects: SubjectWithAssessments[], keep: (exam: Assessment) => boolean) {
  return subjects
    .filter((s) => !s.archived)
    .flatMap((subject) =>
      subject.assessments.filter(keep).map((exam) => ({ exam, subject }) satisfies DayExam),
    )
}

/** Exams on a given local day; tentative exams with a date range are in `possibleExamsOn`. */
export function examsOn(day: Date, subjects: SubjectWithAssessments[]): DayExam[] {
  return activeExams(subjects, (e) => !hasRange(e) && isSameDay(new Date(e.at), day))
}

/** Tentative exams whose possible range (earliest–latest, inclusive) contains the day. */
export function possibleExamsOn(day: Date, subjects: SubjectWithAssessments[]): DayExam[] {
  return activeExams(subjects, (e) => {
    if (!hasRange(e)) return false
    return (
      differenceInCalendarDays(day, new Date(e.at)) >= 0 &&
      differenceInCalendarDays(new Date(e.at_latest!), day) >= 0
    )
  })
}

export function deadlinesOn(day: Date, deadlines: Deadline[]): Deadline[] {
  return deadlines.filter((d) => isSameDay(new Date(d.due_at), day))
}

/** Open deadlines due on the day or within the next `days` days (reminders in the day list). */
export function deadlinesAhead(day: Date, deadlines: Deadline[], days = 7): Deadline[] {
  return deadlines.filter((d) => {
    const diff = differenceInCalendarDays(new Date(d.due_at), day)
    return diff >= 0 && diff <= days && (!d.done || diff === 0)
  })
}

export type DayMarker =
  { kind: 'exam' | 'possible'; id: string; color: string | null } | { kind: 'deadline'; id: string }

export interface DayMarkers {
  /** Shown as dots under the day number, in this order: exams, possible exams, deadlines. */
  visible: DayMarker[]
  /** How many did not fit ("+N"). */
  more: number
}

/** Dots under a calendar day, like Apple Calendar: one per exam / possible exam / deadline. */
export function dayMarkers(
  day: Date,
  subjects: SubjectWithAssessments[],
  deadlines: Deadline[],
  max = 3,
): DayMarkers {
  const all: DayMarker[] = [
    ...examsOn(day, subjects).map(({ exam, subject }) => ({
      kind: 'exam' as const,
      id: exam.id,
      color: subject.color,
    })),
    ...possibleExamsOn(day, subjects).map(({ exam, subject }) => ({
      kind: 'possible' as const,
      id: exam.id,
      color: subject.color,
    })),
    ...deadlinesOn(day, deadlines).map((d) => ({ kind: 'deadline' as const, id: d.id })),
  ]
  // With overflow, the last slot becomes "+N" so the row never gets wider than `max`.
  if (all.length <= max) return { visible: all, more: 0 }
  return { visible: all.slice(0, max - 1), more: all.length - (max - 1) }
}

export interface TimedItem {
  id: string
  startMin: number
  endMin: number
}

export interface PlacedItem<T extends TimedItem> {
  item: T
  /** 0-based column among overlapping items, and how many columns its group needs. */
  lane: number
  lanes: number
}

/**
 * Side-by-side columns for overlapping items on a time axis: each item takes the first free
 * lane; items that overlap (directly or through a chain) share the same lane count.
 */
export function layoutLanes<T extends TimedItem>(items: T[]): PlacedItem<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
  const out: PlacedItem<T>[] = []
  let group: PlacedItem<T>[] = []
  let laneEnds: number[] = []
  let groupEnd = -Infinity
  const close = () => {
    for (const p of group) p.lanes = laneEnds.length
    out.push(...group)
    group = []
    laneEnds = []
  }
  for (const item of sorted) {
    if (item.startMin >= groupEnd) {
      close()
      groupEnd = -Infinity
    }
    let lane = laneEnds.findIndex((end) => end <= item.startMin)
    if (lane === -1) lane = laneEnds.push(item.endMin) - 1
    else laneEnds[lane] = item.endMin
    group.push({ item, lane, lanes: 0 })
    groupEnd = Math.max(groupEnd, item.endMin)
  }
  close()
  return out
}

/** Hours shown on a time axis: at least 08–20, widened to fit every item. */
export function hourRange(items: TimedItem[], from = 8, to = 20): [number, number] {
  const start = Math.min(from, ...items.map((i) => Math.floor(i.startMin / 60)))
  const end = Math.max(to, ...items.map((i) => Math.ceil(i.endMin / 60)))
  return [Math.max(0, start), Math.min(24, end)]
}
