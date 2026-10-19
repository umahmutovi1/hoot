import { useMemo } from 'react'
import type { LocalDate } from '@/lib/day'
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
  const capsRow = useProfile().data?.daily_cap_min

  return useMemo(() => {
    const periods = (periodRows ?? []).map(toPeriod)
    const classes = (timetableRows ?? []).map(toClass)
    const rules = (ruleRows ?? []).map(toRule)
    const exceptions = (exceptionRows ?? []).map(toException)
    const logs = logRows ?? []
    const days = (dayRows ?? []).map(toDay)
    const caps = capsRow?.length === 7 ? capsRow : DEFAULT_CAPS
    /** Everything `freeSlotsOn()` needs for one date. */
    const dayInput = (date: LocalDate): DayInput => ({
      rules,
      exceptions,
      entries: classes,
      periods,
      days,
      caps,
      cancelledEntryIds: cancelledOn(date, logs),
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
      dayInput,
      /** Study minutes of the week that contains `date` (free time, capped per day). */
      weekMinutes: (date: LocalDate) => weekStudyMinutes(date, dayInput(date)),
    }
  }, [periodRows, timetableRows, ruleRows, exceptionRows, logRows, dayRows, capsRow])
}
