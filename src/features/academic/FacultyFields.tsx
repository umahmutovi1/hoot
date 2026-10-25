import { useTranslation } from 'react-i18next'
import { ChipGroup } from '@/features/subjects/fields'
import { isWinter } from '@/lib/academic'
import { semestersOf, YEARS_OF_STUDY, type FacultyValue } from './faculty'

const input =
  'h-[54px] rounded-input glass px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-brand-accent'

/** Fakultet, studijski program, godina studija (and, in onboarding, semestar). */
export function FacultyFields({
  value,
  onChange,
  withSemester = false,
}: {
  value: FacultyValue
  onChange: (value: FacultyValue) => void
  withSemester?: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t('academic.faculty.institution')}</span>
        <input
          value={value.institution}
          maxLength={120}
          autoComplete="organization"
          placeholder={t('academic.faculty.institutionPlaceholder')}
          onChange={(e) => onChange({ ...value, institution: e.target.value })}
          className={input}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t('academic.faculty.program')}</span>
        <input
          value={value.program}
          maxLength={120}
          placeholder={t('academic.faculty.programPlaceholder')}
          onChange={(e) => onChange({ ...value, program: e.target.value })}
          className={input}
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t('academic.faculty.yearOfStudy')}</span>
        <ChipGroup
          options={YEARS_OF_STUDY.map((y) => ({ value: String(y), label: `${y}.` }))}
          value={value.yearOfStudy ? String(value.yearOfStudy) : null}
          onChange={(y) => {
            const yearOfStudy = Number(y)
            // The same season in the new year (3 → 5 when moving from 2nd to 3rd year).
            const winter = value.semester === null || isWinter(value.semester)
            onChange({
              ...value,
              yearOfStudy,
              semester: semestersOf(yearOfStudy)[winter ? 0 : 1]!,
            })
          }}
        />
      </div>
      {withSemester && value.yearOfStudy && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t('academic.semester.label')}</span>
          <ChipGroup
            options={semestersOf(value.yearOfStudy).map((n) => ({
              value: String(n),
              label: t(isWinter(n) ? 'academic.semester.winter' : 'academic.semester.summer', {
                n,
              }),
            }))}
            value={value.semester ? String(value.semester) : null}
            onChange={(n) => onChange({ ...value, semester: Number(n) })}
          />
        </div>
      )}
    </>
  )
}
