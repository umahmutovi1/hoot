import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ScreenTitle } from '@/components/ScreenTitle'
import { useToast } from '@/components/toast-store'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import { newYearOffer, yearLabelOn, yearRange } from '@/lib/academic'
import { addDays, toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { useAcademicTerm, useAddAcademicYear } from './api'
import { useFindAcademicInfo } from './search'
import { FacultyFields } from './FacultyFields'
import { useFacultyValue, useSaveFaculty, type FacultyValue } from './faculty'

/**
 * Postavke → Opće → Fakultet i godina (AkademskaGodina.dc.html 7): faculty, program and year of
 * study, and the list of academic years (current one marked, "Dodaj akademsku godinu").
 */
export function FacultyPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const initial = useFacultyValue()
  const [value, setValue] = useState<FacultyValue | null>(null)
  const current = value ?? initial
  const save = useSaveFaculty()
  const show = useToast((s) => s.show)
  const { years, current: term, today } = useAcademicTerm()
  const add = useAddAcademicYear()
  const find = useFindAcademicInfo()
  const subjects = useSubjects().data ?? []
  const date = (d: string) =>
    format(toDisplayDate(d), 'd. MMM yyyy', { locale: dateFnsLocales[locale] })

  /** The year after the latest one (or this year's when there is none). */
  const addNext = () => {
    const latest = [...years].sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0]
    const offer = newYearOffer(years, today)
    const label =
      offer?.label ?? (latest ? yearLabelOn(addDays(latest.endsOn, 1)) : yearLabelOn(today))
    if (years.some((y) => y.label === label)) return
    add.mutate({
      year: {
        id: crypto.randomUUID(),
        label,
        yearOfStudy: latest?.yearOfStudy
          ? Math.min(6, latest.yearOfStudy + 1)
          : current.yearOfStudy,
        ...yearRange(label),
      },
      first: years.length === 0,
      semesterNo: current.semester,
    })
    show(t('academic.newYear.added', { label }))
  }

  return (
    <div className="flex flex-col gap-3.5">
      <ScreenTitle title={t('academic.faculty.title')} />
      <FacultyFields value={current} onChange={setValue} />
      {value && (
        <Button
          type="button"
          size="pill"
          className="btn-primary"
          onClick={() =>
            void save(current).then(() => {
              setValue(null)
              show(t('academic.faculty.saved'))
              // A new faculty, programme or year: look for its documents in the background.
              if (current.institution.trim()) find.mutate(term?.year.label ?? yearLabelOn(today))
            })
          }
        >
          {t('common.save')}
        </Button>
      )}

      {(current.institution.trim() || initial.institution) && (
        <Link
          to="/settings/academic/found?search=1"
          className="flex h-11 items-center gap-2 self-start rounded-full glass px-4 text-sm font-semibold text-brand"
        >
          {t('academic.found.searchButton')}
        </Link>
      )}

      <h2 className="px-1 pt-2 text-[13px] font-semibold text-ink-muted uppercase">
        {t('academic.years.title')}
      </h2>
      <div className="flex flex-col rounded-card glass px-4 py-1">
        {[...years]
          .sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))
          .map((y) => (
            <div
              key={y.id}
              className="flex min-h-14 items-center justify-between gap-3 border-b border-canvas py-2.5"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px]">
                  {y.yearOfStudy
                    ? t('academic.years.row', { label: y.label, n: y.yearOfStudy })
                    : y.label}
                </span>
                <span className="text-xs text-ink-muted">
                  {t('academic.years.sub', {
                    from: date(y.startsOn),
                    to: date(y.endsOn),
                    count: subjects.filter((s) => s.academic_year_id === y.id).length,
                  })}
                </span>
              </span>
              {term?.year.id === y.id && (
                <span className="flex h-6 items-center rounded-full bg-brand-soft px-2.5 text-xs font-semibold text-brand-strong">
                  {t('academic.years.current')}
                </span>
              )}
            </div>
          ))}
        <button
          type="button"
          onClick={addNext}
          className="flex min-h-12 items-center gap-3 py-2.5 text-[15px] font-semibold text-brand"
        >
          <span
            aria-hidden="true"
            className="flex size-[22px] items-center justify-center rounded-full bg-brand-soft text-[17px]"
          >
            +
          </span>
          {t('academic.years.add')}
        </button>
      </div>
      {years.length === 0 && (
        <span className="px-1 text-xs leading-[1.4] text-ink-muted">
          {t('academic.years.empty')}
        </span>
      )}
    </div>
  )
}
