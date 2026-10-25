import { useTranslation } from 'react-i18next'
import { ChipGroup } from '@/features/subjects/fields'
import { isWinter } from '@/lib/academic'
import { useAcademicTerm } from './api'

export interface Term {
  academicYearId: string | null
  semesterNo: number | null
}

/**
 * "Semestar" on Novi predmet (AkademskaGodina.dc.html 3): the current semester is picked without
 * a question; one tap moves the subject to the other semester of the year or out of any.
 * Nothing shows before the first academic year exists.
 */
export function SemesterField({
  value,
  onChange,
}: {
  value: Term
  onChange: (term: Term) => void
}) {
  const { t } = useTranslation()
  const { years, current } = useAcademicTerm()
  if (years.length === 0) return null
  const key = (term: Term) =>
    term.academicYearId ? `${term.academicYearId}:${term.semesterNo ?? ''}` : 'none'
  const options: { value: string; label: string; term: Term }[] = []
  if (current) {
    const base = current.year.yearOfStudy ? (current.year.yearOfStudy - 1) * 2 : 0
    for (const semester of [base + 1, base + 2])
      options.push({
        value: `${current.year.id}:${semester}`,
        label: t(isWinter(semester) ? 'academic.semester.winter' : 'academic.semester.summer', {
          n: semester,
        }),
        term: { academicYearId: current.year.id, semesterNo: semester },
      })
  }
  // A subject of another year keeps its own semester as a choice.
  const own = years.find((y) => y.id === value.academicYearId)
  if (own && !options.some((o) => o.value === key(value)))
    options.unshift({
      value: key(value),
      label: t('academic.semester.ofYear', { n: value.semesterNo ?? '—', year: own.label }),
      term: value,
    })
  options.push({
    value: 'none',
    label: t('academic.semester.none'),
    term: { academicYearId: null, semesterNo: null },
  })

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{t('academic.semester.label')}</span>
      <ChipGroup
        options={options}
        value={key(value)}
        onChange={(v) => onChange(options.find((o) => o.value === v)!.term)}
      />
      {current && (
        <span className="px-1 text-xs leading-[1.4] text-ink-muted">
          {t('academic.semester.hint', { year: current.year.label })}
        </span>
      )}
    </div>
  )
}
