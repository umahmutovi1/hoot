import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { scheduleKey, usePeriods } from '@/features/schedule/api'
import { useDayBoundary } from '@/features/settings/profile'
import { subjectsKey } from '@/features/subjects/api'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import {
  semesterOn,
  yearOn,
  type AcademicYear,
  type SubjectTerm,
  type TeachingPeriod,
} from '@/lib/academic'
import { localDay, type LocalDate } from '@/lib/day'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type AcademicYearRow = Tables<'academic_years'>

export const academicYearsKey = (userId: string | undefined) => ['academic_years', userId] as const

function useUserId() {
  return useAuth().session?.user.id
}

export const toYear = (row: AcademicYearRow): AcademicYear => ({
  id: row.id,
  label: row.label,
  yearOfStudy: row.year_of_study,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
})

export function useAcademicYears() {
  const userId = useUserId()
  return useQuery({
    queryKey: academicYearsKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<AcademicYearRow[]> => {
      const { data, error } = await supabase.from('academic_years').select('*').order('starts_on')
      if (error) throw error
      return data
    },
  })
}

/**
 * Years, teaching periods and the semester running today; `defaultTerm` is what a new subject
 * gets without a question (the current semester), null without academic years.
 */
export function useAcademicTerm() {
  const rows = useAcademicYears().data
  const periodRows = usePeriods().data
  const boundary = useDayBoundary()
  const [now] = useState(() => new Date())
  const today = localDay(now, boundary)
  return useMemo(() => {
    const years = (rows ?? []).map(toYear)
    const periods: TeachingPeriod[] = (periodRows ?? [])
      .filter((p) => p.kind === 'teaching')
      .map((p) => ({
        startsOn: p.starts_on,
        endsOn: p.ends_on,
        academicYearId: p.academic_year_id,
      }))
    // A year that has ended is not current: its semesters fold under "Ranije" until a new one.
    const year = yearOn(years, today)
    const current = year ? { year, semester: semesterOn(year, periods, today) } : null
    return {
      years,
      periods,
      today,
      current,
      defaultTerm: current
        ? { academicYearId: current.year.id, semesterNo: current.semester }
        : null,
    }
  }, [rows, periodRows, today])
}

/** What grouping needs from a subject: done (all exams passed or annulled) and an active exam. */
export function subjectTerm(s: SubjectWithAssessments, today: LocalDate): SubjectTerm {
  const open = s.assessments.filter((a) => !a.passed && !a.result_annulled)
  return {
    id: s.id,
    academicYearId: s.academic_year_id,
    semesterNo: s.semester_no,
    done: s.assessments.length > 0 && open.length === 0,
    activeExam: open.some((a) => (a.at_latest ?? a.at).slice(0, 10) >= today),
  }
}

/**
 * Add an academic year. Periods of the academic calendar in its dates without a year join it;
 * the first year also takes the active subjects without one (current semester), so the list is
 * grouped right away without asking.
 */
export function useAddAcademicYear() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      year,
      first,
      semesterNo,
    }: {
      year: AcademicYear
      /** No academic year existed before. */
      first: boolean
      semesterNo: number | null
    }) => {
      const { error } = await supabase.from('academic_years').upsert({
        id: year.id,
        label: year.label,
        year_of_study: year.yearOfStudy,
        starts_on: year.startsOn,
        ends_on: year.endsOn,
      })
      if (error) throw error
      const { error: pError } = await supabase
        .from('academic_periods')
        .update({ academic_year_id: year.id })
        .is('academic_year_id', null)
        .gte('starts_on', year.startsOn)
        .lte('starts_on', year.endsOn)
      if (pError) throw pError
      if (first) {
        const { error: sError } = await supabase
          .from('subjects')
          .update({ academic_year_id: year.id, semester_no: semesterNo })
          .is('academic_year_id', null)
          .eq('archived', false)
        if (sError) throw sError
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: academicYearsKey(userId) })
      void queryClient.invalidateQueries({ queryKey: scheduleKey('academic_periods', userId) })
      void queryClient.invalidateQueries({ queryKey: subjectsKey(userId) })
    },
  })
}

export function useUpdateAcademicYear() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, yearOfStudy }: { id: string; yearOfStudy: number | null }) => {
      const { error } = await supabase
        .from('academic_years')
        .update({ year_of_study: yearOfStudy })
        .eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: academicYearsKey(userId) }),
  })
}
