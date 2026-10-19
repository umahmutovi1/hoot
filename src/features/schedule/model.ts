import type { Tables } from '@/types/database'
import type {
  AvailabilityDay,
  AvailabilityException,
  FreeSlot,
  AvailabilityRule,
  ClassEntry,
  ExamSession,
  Period,
  PeriodKind,
  WeekParity,
} from '@/lib/schedule'
import type { PaceLog } from '@/lib/pace'

export type PeriodRow = Tables<'academic_periods'>
export type TimetableRow = Tables<'timetable_entries'>
export type RuleRow = Tables<'availability_rules'>
export type ExceptionRow = Tables<'availability_exceptions'>
export type DayRow = Tables<'availability_days'>
export type LectureLogRow = Tables<'lecture_logs'>
export type ClassKind = TimetableRow['kind']

export const PERIOD_KINDS = ['teaching', 'exam', 'holiday'] as const
export const EXAM_SESSIONS = ['partial', 'regular', 'makeup'] as const
export const CLASS_KINDS = ['lecture', 'exercise', 'lab', 'other'] as const
export const WEEK_PARITIES = ['odd', 'even'] as const

export function toPeriod(row: PeriodRow): Period {
  return {
    id: row.id,
    kind: row.kind as PeriodKind,
    examSession: (row.exam_session as ExamSession | null) ?? null,
    title: row.title,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }
}

export type ClassWithRow = ClassEntry & { row: TimetableRow }

export function toClass(row: TimetableRow): ClassWithRow {
  return {
    id: row.id,
    subjectId: row.subject_id,
    kind: row.kind,
    weekday: row.weekday,
    startMin: row.start_min,
    endMin: row.end_min,
    weekParity: (row.week_parity as WeekParity | null) ?? null,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    row,
  }
}

export function toRule(row: RuleRow): AvailabilityRule {
  return {
    weekday: row.weekday,
    startMin: row.start_min,
    endMin: row.end_min,
    overClasses: row.over_classes,
  }
}

export function toException(row: ExceptionRow): AvailabilityException {
  return {
    onDate: row.on_date,
    startMin: row.start_min,
    endMin: row.end_min,
    isBusy: row.is_busy,
  }
}

export function toPaceLog(row: LectureLogRow): PaceLog {
  return {
    id: row.id,
    onDate: row.on_date,
    createdAt: row.created_at,
    sourceId: row.source_id,
    upToUnitId: row.up_to_unit_id,
    cancelled: row.cancelled,
  }
}

/** Entry ids cancelled on a date, from lecture logs. */
export function cancelledOn(date: string, logs: LectureLogRow[]): Set<string> {
  return new Set(
    logs
      .filter((l) => l.cancelled && l.on_date === date && l.timetable_entry_id)
      .map((l) => l.timetable_entry_id!),
  )
}

/** Which of the three exception kinds a row is (Dostupnost → Izuzeci). */
export function exceptionType(e: Pick<ExceptionRow, 'is_busy' | 'start_min'>) {
  if (!e.is_busy) return 'extraFree' as const
  return e.start_min === null ? ('busyDay' as const) : ('busyTime' as const)
}

/** Stored shape of `availability_days.slots`. */
export interface StoredSlot {
  start_min: number
  end_min: number
  over_classes?: boolean
}

export function toDay(row: DayRow): AvailabilityDay {
  const slots = Array.isArray(row.slots) ? (row.slots as unknown as StoredSlot[]) : null
  return {
    onDate: row.on_date,
    slots:
      slots?.map((x): FreeSlot => ({
        startMin: x.start_min,
        endMin: x.end_min,
        overClasses: x.over_classes,
      })) ?? null,
    capMin: row.cap_min,
  }
}

export function toStoredSlots(slots: FreeSlot[]): StoredSlot[] {
  return slots.map((x) => ({
    start_min: x.startMin,
    end_min: x.endMin,
    ...(x.overClasses ? { over_classes: true } : {}),
  }))
}
