import { useMemo } from 'react'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { cancelledOn, type ClassWithRow } from '@/features/schedule/model'
import { useSubjects } from '@/features/subjects/api'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import type { LocalDate } from '@/lib/day'
import { busyEventsOn, calendarStatus, classesOn, type CalendarStatus } from '@/lib/schedule'

export interface DayClass {
  id: string
  startMin: number
  endMin: number
  entry: ClassWithRow
  subject?: SubjectWithAssessments
  cancelled: boolean
}

/** Busy time from a connected calendar on one day (hatched, "iz kalendara …"). */
export interface DayBusy {
  id: string
  eventId: string
  startMin: number
  endMin: number
  title: string | null
  /** The feed's name, for "iz kalendara Google". */
  source: string
  /** From a connected Google calendar: "iz Google kalendara". */
  google: boolean
  ignored: boolean
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
    /** Busy events of a date; ignored ones too (shown faded, tap brings them back). */
    const busyFor = (date: LocalDate): DayBusy[] => {
      const all = data.events.map((e) => ({ ...e, ignored: false }))
      return busyEventsOn(date, all, data.feeds, data.timeZone).map((e) => ({
        id: `${e.id}-${date}`,
        eventId: e.id,
        startMin: e.startMin,
        endMin: e.endMin,
        title: e.title ?? null,
        source: data.feedRows.find((f) => f.id === e.feedId)?.title ?? '',
        google: data.feedRows.find((f) => f.id === e.feedId)?.source === 'google',
        ignored: data.events.find((x) => x.id === e.id)?.ignored ?? false,
      }))
    }
    return { classesFor, statusOf, busyFor }
  }, [data, subjects])
}
