import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { TablesInsert } from '@/types/database'
import { useAuth } from '@/features/auth/auth-context'
import { subjectsKey } from '@/features/subjects/api'
import { examAtFromDate } from '@/features/subjects/model'
import { supabase } from '@/lib/supabase'
import type { ExceptionRow, LectureLogRow, PeriodRow, RuleRow, TimetableRow } from './model'

// IDs come from the client (crypto.randomUUID()), so writes are idempotent upserts that the
// offline queue (Stage 7) can replay.

type ScheduleTable =
  | 'academic_periods'
  | 'timetable_entries'
  | 'availability_rules'
  | 'availability_exceptions'
  | 'lecture_logs'

export const scheduleKey = (table: ScheduleTable, userId: string | undefined) =>
  [table, userId] as const

function useUserId() {
  return useAuth().session?.user.id
}

const ORDER: Record<ScheduleTable, string> = {
  academic_periods: 'starts_on',
  timetable_entries: 'start_min',
  availability_rules: 'start_min',
  availability_exceptions: 'on_date',
  lecture_logs: 'on_date',
}

function useTable<T>(table: ScheduleTable) {
  const userId = useUserId()
  return useQuery({
    queryKey: scheduleKey(table, userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase.from(table).select('*').order(ORDER[table])
      if (error) throw error
      return data as T[]
    },
  })
}

export const usePeriods = () => useTable<PeriodRow>('academic_periods')
export const useTimetable = () => useTable<TimetableRow>('timetable_entries')
export const useAvailabilityRules = () => useTable<RuleRow>('availability_rules')
export const useAvailabilityExceptions = () => useTable<ExceptionRow>('availability_exceptions')
export const useLectureLogs = () => useTable<LectureLogRow>('lecture_logs')

async function patchList<T extends { id: string }>(
  queryClient: QueryClient,
  key: readonly unknown[],
  patch: (list: T[]) => T[],
) {
  await queryClient.cancelQueries({ queryKey: key })
  const previous = queryClient.getQueryData<T[]>(key)
  queryClient.setQueryData<T[]>(key, (old) => patch(old ?? []))
  return () => queryClient.setQueryData(key, previous)
}

const now = () => new Date().toISOString()

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item]
}

/** Upsert / delete for one table, with an optimistic cache update. */
function useUpsert<T extends { id: string; user_id: string }>(
  table: ScheduleTable,
  defaults: Partial<T> = {},
) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const key = scheduleKey(table, userId)
  return useMutation({
    mutationFn: async (row: Partial<T> & { id: string }) => {
      const { error } = await supabase.from(table).upsert(row as never)
      if (error) throw error
    },
    onMutate: (row) =>
      patchList<T>(queryClient, key, (list) => {
        const existing = list.find((x) => x.id === row.id)
        return upsertById(list, {
          ...defaults,
          user_id: userId!,
          updated_at: now(),
          ...existing,
          ...row,
        } as unknown as T)
      }),
    onError: (_e, _row, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

function useDelete(table: ScheduleTable, also: ScheduleTable[] = []) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const key = scheduleKey(table, userId)
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) =>
      patchList<{ id: string }>(queryClient, key, (list) => list.filter((x) => x.id !== id)),
    onError: (_e, _id, rollback) => rollback?.(),
    onSettled: () => {
      for (const t of [table, ...also])
        queryClient.invalidateQueries({ queryKey: scheduleKey(t, userId) })
    },
  })
}

// ------------------------------------------------------------------ academic calendar

/**
 * Saves a period. A teaching period's dates are copied into its timetable entries, and an exam
 * period's dates move the tentative exams that are "in" it.
 */
export function useSavePeriod() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const key = scheduleKey('academic_periods', userId)
  return useMutation({
    mutationFn: async (row: TablesInsert<'academic_periods'> & { id: string }) => {
      const { error } = await supabase.from('academic_periods').upsert(row)
      if (error) throw error
      if (row.kind === 'teaching') {
        const { error: e } = await supabase
          .from('timetable_entries')
          .update({ valid_from: row.starts_on, valid_to: row.ends_on })
          .eq('period_id', row.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase
          .from('assessments')
          .update({ at: examAtFromDate(row.starts_on), at_latest: examAtFromDate(row.ends_on) })
          .eq('exam_period_id', row.id)
          .eq('date_tentative', true)
        if (e) throw e
      }
    },
    onMutate: (row) =>
      patchList<PeriodRow>(queryClient, key, (list) =>
        upsertById(list, {
          created_at: now(),
          exam_session: null,
          ...list.find((p) => p.id === row.id),
          ...row,
          user_id: userId!,
          updated_at: now(),
        } as PeriodRow).sort((a, b) => a.starts_on.localeCompare(b.starts_on)),
      ),
    onError: (_e, _row, rollback) => rollback?.(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: scheduleKey('timetable_entries', userId) })
      queryClient.invalidateQueries({ queryKey: subjectsKey(userId) })
    },
  })
}

export const useDeletePeriod = () => useDelete('academic_periods', ['timetable_entries'])

// ------------------------------------------------------------------ timetable

export const useSaveClass = () =>
  useUpsert<TimetableRow>('timetable_entries', { location: null, week_parity: null })
export const useDeleteClass = () => useDelete('timetable_entries', ['lecture_logs'])

// ------------------------------------------------------------------ availability

export const useSaveRule = () => useUpsert<RuleRow>('availability_rules')
export const useDeleteRule = () => useDelete('availability_rules')
export const useSaveException = () =>
  useUpsert<ExceptionRow>('availability_exceptions', {
    start_min: null,
    end_min: null,
    is_busy: true,
    lecture_log_id: null,
  })
export const useDeleteException = () => useDelete('availability_exceptions')

// ------------------------------------------------------------------ lecture logs

export interface LectureLogInput {
  logs: (TablesInsert<'lecture_logs'> & { id: string })[]
  /** "Nastava otkazana": frees the class slot for that day. */
  freeSlot?: TablesInsert<'availability_exceptions'> & { id: string }
}

/** Saves one log per source whose boundary moved, or a cancelled class with its exception. */
export function useSaveLectureLogs() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const key = scheduleKey('lecture_logs', userId)
  return useMutation({
    mutationFn: async ({ logs, freeSlot }: LectureLogInput) => {
      if (logs.length > 0) {
        const { error } = await supabase.from('lecture_logs').upsert(logs)
        if (error) throw error
      }
      if (freeSlot) {
        const { error } = await supabase.from('availability_exceptions').upsert(freeSlot)
        if (error) throw error
      }
    },
    onMutate: ({ logs }) =>
      patchList<LectureLogRow>(queryClient, key, (list) =>
        logs.reduce(
          (acc, l) =>
            upsertById(acc, {
              created_at: now(),
              cancelled: false,
              note: null,
              source_id: null,
              timetable_entry_id: null,
              up_to_unit_id: null,
              ...l,
              user_id: userId!,
              updated_at: now(),
            } as LectureLogRow),
          list,
        ),
      ),
    onError: (_e, _input, rollback) => rollback?.(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: scheduleKey('availability_exceptions', userId) })
    },
  })
}

/** Deleting a log also removes its "class cancelled" exception (FK cascade). */
export const useDeleteLectureLog = () => useDelete('lecture_logs', ['availability_exceptions'])
