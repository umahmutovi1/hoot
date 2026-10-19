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

/** Exams of active subjects on a given local day. */
export function examsOn(day: Date, subjects: SubjectWithAssessments[]): DayExam[] {
  return subjects
    .filter((s) => !s.archived)
    .flatMap((subject) =>
      subject.assessments
        .filter((exam) => isSameDay(new Date(exam.at), day))
        .map((exam) => ({ exam, subject })),
    )
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
