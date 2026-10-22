import { useState } from 'react'
import { useDayBoundary } from '@/features/settings/profile'
import { useSubjects } from '@/features/subjects/api'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import { diffDays, localDay, wallClock } from '@/lib/day'
import { lecturesToLog } from '@/lib/schedule'
import { readSkippedLectures } from './lectureSkips'
import type { ClassWithRow } from './model'
import { useScheduleData } from './useScheduleData'

export interface PendingLecture {
  entry: ClassWithRow
  subject: SubjectWithAssessments
}

/**
 * Lectures of the local day that have ended and have no "Dokle ste stigli?" log yet; each stays
 * until the day ends or it is skipped.
 */
export function usePendingLectures() {
  const boundary = useDayBoundary()
  const data = useScheduleData()
  const { data: subjects = [] } = useSubjects()
  const [now] = useState(() => new Date())
  const [skipped, setSkipped] = useState(readSkippedLectures)

  const today = localDay(now, boundary)
  const wall = wallClock(now, boundary.timeZone)
  // After midnight (before the day boundary) the lecture day is yesterday: all of it has ended.
  const calendarToday = `${wall.year}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`
  const nowMin = wall.minutes + diffDays(today, calendarToday) * 1440
  const logged = new Set(
    data.logRows
      .filter((l) => l.timetable_entry_id)
      .map((l) => `${l.timetable_entry_id}:${l.on_date}`),
  )
  const pending: PendingLecture[] = lecturesToLog(
    today,
    nowMin,
    data.classes,
    data.periods,
    logged,
    skipped,
  ).flatMap((entry) => {
    const subject = subjects.find((s) => s.id === entry.subjectId)
    return subject ? [{ entry, subject }] : []
  })
  return { pending, today, refresh: () => setSkipped(readSkippedLectures()) }
}
