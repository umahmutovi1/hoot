import { useCallback } from 'react'
import { useProfile, useUpdateProfile } from '@/features/settings/profile'
import { currentYear, semesterOn, yearLabelOn, yearRange } from '@/lib/academic'
import { useAcademicTerm, useAddAcademicYear, useUpdateAcademicYear } from './api'

export interface FacultyValue {
  institution: string
  program: string
  yearOfStudy: number | null
  /** Onboarding only: the semester the first academic year's subjects get. */
  semester: number | null
}

export const YEARS_OF_STUDY = [1, 2, 3, 4, 5, 6] as const

/** Semesters of a year of study: 3 and 4 for the 2nd year. */
export const semestersOf = (yearOfStudy: number) => [yearOfStudy * 2 - 1, yearOfStudy * 2]

/**
 * Saves the faculty on the profile. Without an academic year for today the first one is added
 * (it takes the active subjects without a year); otherwise the current year gets the year of study.
 */
export function useSaveFaculty() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const addYear = useAddAcademicYear()
  const updateYear = useUpdateAcademicYear()
  const { years, periods, today } = useAcademicTerm()
  return useCallback(
    async (v: FacultyValue) => {
      const institution = v.institution.trim() || null
      const program = v.program.trim() || null
      if (
        institution !== (profile?.institution ?? null) ||
        program !== (profile?.study_program ?? null) ||
        v.yearOfStudy !== (profile?.year_of_study ?? null)
      )
        await update.mutateAsync({
          institution,
          study_program: program,
          year_of_study: v.yearOfStudy,
        })
      if (!v.yearOfStudy) return
      const year = currentYear(years, today)
      if (!year || year.endsOn < today) {
        const label = yearLabelOn(today)
        const fresh = {
          id: crypto.randomUUID(),
          label,
          yearOfStudy: v.yearOfStudy,
          ...yearRange(label),
        }
        await addYear.mutateAsync({
          year: fresh,
          first: years.length === 0,
          semesterNo: v.semester ?? semesterOn(fresh, periods, today),
        })
      } else if (year.yearOfStudy !== v.yearOfStudy) {
        await updateYear.mutateAsync({ id: year.id, yearOfStudy: v.yearOfStudy })
      }
    },
    [profile, update, addYear, updateYear, years, periods, today],
  )
}

/** Form value from the profile; the semester is the one running today (season from the date). */
export function useFacultyValue(): FacultyValue {
  const { data: profile } = useProfile()
  const { current, periods, today } = useAcademicTerm()
  const yearOfStudy = profile?.year_of_study ?? current?.year.yearOfStudy ?? null
  const label = yearLabelOn(today)
  const semester =
    current?.semester ??
    semesterOn(
      { id: '', label, yearOfStudy: yearOfStudy ?? 1, ...yearRange(label) },
      periods,
      today,
    )
  return {
    institution: profile?.institution ?? '',
    program: profile?.study_program ?? '',
    yearOfStudy,
    semester,
  }
}
