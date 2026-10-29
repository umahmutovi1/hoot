import { useMemo } from 'react'
import type { LocalDate } from '@/lib/day'
import { toEvent, toFeed, useCalendarFeeds, useExternalEvents } from '@/features/calendars/api'
import { eventKinds } from '@/features/calendars/kinds'
import { useSubjects } from '@/features/subjects/api'
import { useProfile } from '@/features/settings/profile'
import { DEFAULT_CAPS, weekStudyMinutes, type DayInput } from '@/lib/schedule'
import {
  useAvailabilityDays,
  useAvailabilityExceptions,
  useAvailabilityRules,
  useLectureLogs,
  usePeriods,
  useTimetable,
} from './api'
import { cancelledOn, toClass, toDay, toException, toPeriod, toRule } from './model'

/** Academic calendar, timetable, availability and lecture logs, mapped for `src/lib/schedule`. */
export function useScheduleData() {
  const periodRows = usePeriods().data
  const timetableRows = useTimetable().data
  const ruleRows = useAvailabilityRules().data
  const exceptionRows = useAvailabilityExceptions().data
  const logRows = useLectureLogs().data
  const dayRows = useAvailabilityDays().data
  const profile = useProfile().data
  const capsRow = profile?.daily_cap_min
  const timeZone = profile?.timezone ?? 'Europe/Sarajevo'
  const feedRows = useCalendarFeeds().data
  const eventRows = useExternalEvents().data
  const subjectRows = useSubjects().data

  return useMemo(() => {
    const periods = (periodRows ?? []).map(toPeriod)
    const classes = (timetableRows ?? []).map(toClass)
    const rules = (ruleRows ?? []).map(toRule)
    const exceptions = (exceptionRows ?? []).map(toException)
    const logs = logRows ?? []
    const days = (dayRows ?? []).map(toDay)
    const caps = capsRow?.length === 7 ? capsRow : DEFAULT_CAPS
    const feeds = (feedRows ?? []).map(toFeed)
    // Deadlines and free events do not take study time (classification, Stage 10d).
    const kinds = eventKinds(
      eventRows ?? [],
      feedRows ?? [],
      (subjectRows ?? []).filter((x) => !x.archived).map((x) => x.name),
      timeZone,
    )
    const events = (eventRows ?? []).map((row) => ({
      ...toEvent(row),
      kind: kinds.kindOf.get(row.id),
    }))
    /** Everything `freeSlotsOn()` needs for one date. */
    const dayInput = (date: LocalDate): DayInput => ({
      rules,
      exceptions,
      entries: classes,
      periods,
      days,
      caps,
      cancelledEntryIds: cancelledOn(date, logs),
      feeds,
      events,
      timeZone,
    })
    return {
      periodRows: periodRows ?? [],
      timetableRows: timetableRows ?? [],
      ruleRows: ruleRows ?? [],
      exceptionRows: exceptionRows ?? [],
      logRows: logs,
      dayRows: dayRows ?? [],
      days,
      caps,
      periods,
      classes,
      rules,
      exceptions,
      feeds,
      feedRows: feedRows ?? [],
      events,
      eventKinds: kinds,
      timeZone,
      dayInput,
      /** Study minutes of the week that contains `date` (free time, capped per day). */
      weekMinutes: (date: LocalDate) => weekStudyMinutes(date, dayInput(date)),
    }
  }, [
    periodRows,
    timetableRows,
    ruleRows,
    exceptionRows,
    logRows,
    dayRows,
    capsRow,
    timeZone,
    feedRows,
    eventRows,
    subjectRows,
  ])
}
