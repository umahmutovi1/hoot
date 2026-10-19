import { useMemo } from 'react'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { cancelledOn, type ClassWithRow } from '@/features/schedule/model'
import { useSubjects } from '@/features/subjects/api'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import type { LocalDate } from '@/lib/day'
import { calendarStatus, classesOn, type CalendarStatus } from '@/lib/schedule'

export interface DayClass {
  id: string
  startMin: number
  endMin: number
  entry: ClassWithRow
  subject?: SubjectWithAssessments
  cancelled: boolean
}

/** Classes and academic-calendar status of any day, for the calendar views. */
export function useAgenda() {
  const data = useScheduleData()
  const { data: subjects = [] } = useSubjects()
  return useMemo(() => {
    const classesFor = (date: LocalDate): DayClass[] => {
      const cancelled = cancelledOn(date, data.logRows)
      return classesOn(date, data.classes, data.periods).map((entry) => ({
        id: `${entry.id}-${date}`,
        startMin: entry.startMin,
        endMin: entry.endMin,
        entry,
        subject: subjects.find((s) => s.id === entry.subjectId),
        cancelled: cancelled.has(entry.id),
      }))
    }
    const statusOf = (date: LocalDate): CalendarStatus | null => calendarStatus(date, data.periods)
    return { classesFor, statusOf }
  }, [data, subjects])
}
