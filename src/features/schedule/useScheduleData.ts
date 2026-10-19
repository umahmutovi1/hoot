import { useMemo } from 'react'
import type { LocalDate } from '@/lib/day'
import { weekFreeMinutes, type DayInput } from '@/lib/schedule'
import {
  useAvailabilityExceptions,
  useAvailabilityRules,
  useLectureLogs,
  usePeriods,
  useTimetable,
} from './api'
import { cancelledOn, toClass, toException, toPeriod, toRule } from './model'

/** Academic calendar, timetable, availability and lecture logs, mapped for `src/lib/schedule`. */
export function useScheduleData() {
  const periodRows = usePeriods().data
  const timetableRows = useTimetable().data
  const ruleRows = useAvailabilityRules().data
  const exceptionRows = useAvailabilityExceptions().data
  const logRows = useLectureLogs().data

  return useMemo(() => {
    const periods = (periodRows ?? []).map(toPeriod)
    const classes = (timetableRows ?? []).map(toClass)
    const rules = (ruleRows ?? []).map(toRule)
    const exceptions = (exceptionRows ?? []).map(toException)
    const logs = logRows ?? []
    /** Everything `freeSlotsOn()` needs for one date. */
    const dayInput = (date: LocalDate): DayInput => ({
      rules,
      exceptions,
      entries: classes,
      periods,
      cancelledEntryIds: cancelledOn(date, logs),
    })
    return {
      periodRows: periodRows ?? [],
      timetableRows: timetableRows ?? [],
      ruleRows: ruleRows ?? [],
      exceptionRows: exceptionRows ?? [],
      logRows: logs,
      periods,
      classes,
      rules,
      exceptions,
      dayInput,
      /** Net free minutes of the week that contains `date`. */
      weekMinutes: (date: LocalDate) => weekFreeMinutes(date, dayInput(date)),
    }
  }, [periodRows, timetableRows, ruleRows, exceptionRows, logRows])
}
