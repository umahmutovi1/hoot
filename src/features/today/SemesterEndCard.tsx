import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CapIcon, CloseIcon } from '@/components/icons'
import { subjectTerm, useAcademicTerm } from '@/features/academic/api'
import { usePlanUi } from '@/features/plan/ui'
import { useDayBoundary } from '@/features/settings/profile'
import { useSubjects } from '@/features/subjects/api'
import { semesterEnd, SEMESTER_END_DAYS } from '@/lib/academic'
import { addDays, localDay } from '@/lib/day'

/**
 * "Kraj semestra" on Danas (PRD "Dopune, 29. okt 2026"): once the semester's last exam is behind,
 * its results (passed / carried over, as in Predmeti) and the next semester: its subjects when the
 * plan and programme already brought them, otherwise the import.
 */
export function SemesterEndCard() {
  const { t } = useTranslation()
  const term = useAcademicTerm()
  const { data: subjects = [] } = useSubjects()
  const { snoozed, snooze } = usePlanUi()
  const boundary = useDayBoundary()
  const end = semesterEnd(
    subjects.map((s) => ({
      ...subjectTerm(s, term.today),
      examDays: s.assessments
        .filter((a) => !a.contingent)
        .map((a) => localDay(new Date(a.at_latest ?? a.at), { ...boundary, dayStartMin: 0 })),
    })),
    term.today,
  )
  if (!end) return null
  const key = `semester-end:${end.yearId}:${end.semester}`
  if ((snoozed[key] ?? '') >= term.today) return null
  const name = (id: string) => subjects.find((s) => s.id === id)?.name ?? ''
  return (
    <section className="surface flex flex-col gap-3 rounded-card-lg p-[18px]">
      <div className="flex items-start gap-3">
        <span
          className="icon-tile flex size-[38px] shrink-0 items-center justify-center rounded-[12px]"
          aria-hidden="true"
        >
          <CapIcon size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-[15px] font-semibold">
            {t('semesterEnd.title', { n: end.semester })}
          </h2>
          <p className="text-[13px] leading-[1.35] text-ink-muted">
            {t('semesterEnd.summary', { passed: end.passed.length, carried: end.carried.length })}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={() => snooze(key, addDays(end.lastExamOn, SEMESTER_END_DAYS))}
          className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center text-ink-muted"
        >
          <CloseIcon size={16} />
        </button>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {[...end.passed, ...end.carried].map((id) => (
          <li key={id}>
            <Link to={`/subjects/${id}`} className="flex items-center justify-between gap-3">
              <span className="truncate">{name(id)}</span>
              <span
                className={
                  end.passed.includes(id)
                    ? 'shrink-0 font-semibold text-subject-green-ink'
                    : 'shrink-0 font-semibold text-warning-ink'
                }
              >
                {t(end.passed.includes(id) ? 'semesterEnd.passed' : 'semesterEnd.carried')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {end.carried.length > 0 && (
        <p className="text-[13px] leading-[1.35] text-ink-muted">{t('semesterEnd.carriedHint')}</p>
      )}
      <Link
        to={end.next.length > 0 ? '/subjects' : '/settings/academic'}
        className="btn-primary flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold"
      >
        {end.next.length > 0
          ? t('semesterEnd.nextSubjects', { count: end.next.length })
          : t('semesterEnd.addNext')}
      </Link>
    </section>
  )
}
