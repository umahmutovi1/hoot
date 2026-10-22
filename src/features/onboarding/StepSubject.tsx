import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSources } from '@/features/plan/api'
import { createRoughSource } from '@/features/sources/api'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useDayBoundary } from '@/features/settings/profile'
import { useSaveSubject, useSubjects } from '@/features/subjects/api'
import { subjectToForm } from '@/features/subjects/mappers'
import { RoughSizeField } from '@/features/subjects/RoughSizeField'
import { useRoughTexts } from '@/features/subjects/roughTexts'
import { EXAM_GRADE_DEFAULTS, type SubjectForm } from '@/features/subjects/schemas'
import { localDay } from '@/lib/day'
import type { RoughSize } from '@/lib/estimates/rough'
import { suggestExamPeriod } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { dateRangeLabel } from '@/features/schedule/format'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { StepTitle, type StepProps } from './OnboardingPage'

/**
 * Step 7 "Prvi predmet": a name, one exam (a date, or a period from the academic calendar) and
 * the rough size of the material. The exam covers the whole rough source; real content and the
 * exact scope come later. Empty name = the step is skipped. A subject made in step 2 (timetable)
 * is offered by name and gets the exam and material it is missing.
 */
export function StepSubject({ setSave }: StepProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const boundary = useDayBoundary()
  const save = useSaveSubject()
  const existing = useSubjects().data ?? []
  const { data: sources = [] } = useAllSources()
  const roughTexts = useRoughTexts()
  const { periods } = useScheduleData()
  const [today] = useState(() => localDay(new Date(), boundary))
  const period =
    suggestExamPeriod('partial', periods, today) ?? suggestExamPeriod('final', periods, today)
  const [name, setName] = useState(
    () => existing.find((x) => !x.archived && x.assessments.length === 0)?.name ?? '',
  )
  const [exam, setExam] = useState(() => t('onboarding.subject.examDefault'))
  const [date, setDate] = useState('')
  const [usePeriod, setUsePeriod] = useState(Boolean(period))
  const [size, setSize] = useState<RoughSize | null>('medium')

  useEffect(() => {
    setSave(async () => {
      if (!name.trim()) return
      const match = existing.find(
        (x) => !x.archived && x.name.trim().toLowerCase() === name.trim().toLowerCase(),
      )
      const tentative = usePeriod && period
      const examDate = tentative ? period.startsOn : date
      const assessment = {
        id: crypto.randomUUID(),
        kind: 'partial' as const,
        title: exam.trim() || t('onboarding.subject.examDefault'),
        date: examDate,
        format: 'written' as const,
        scopeAll: true,
        contingent: false,
        dateTentative: Boolean(tentative),
        dateLatest: tentative ? period.endsOn : null,
        examPeriodId: tentative ? period.id : null,
        ...EXAM_GRADE_DEFAULTS,
      }
      // A subject from the timetable (or this step, on the way back) keeps what it has.
      const form: SubjectForm = match
        ? subjectToForm(match)
        : {
            id: crypto.randomUUID(),
            name: name.trim(),
            color: 'pink',
            priority: 3,
            studyMode: 'regular',
            campaignStartOn: null,
            targetGrade: null,
            assessments: [],
          }
      if (examDate && form.assessments.length === 0) form.assessments = [assessment]
      if (!match || form.assessments.length !== match.assessments.length)
        await save.mutateAsync(form)
      const hasMaterial = sources.some((x) => x.subject_id === form.id)
      if (size && !hasMaterial)
        await createRoughSource({ subjectId: form.id, size, ...roughTexts(size) })
    })
  }, [name, exam, date, usePeriod, size, period, existing, sources]) // eslint-disable-line react-hooks/exhaustive-deps

  const field = 'h-12 rounded-input glass px-4 text-[15px] outline-none'
  return (
    <>
      <StepTitle title={t('onboarding.subject.title')} sub={t('onboarding.subject.sub')} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t('subjects.form.name')}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder={t('onboarding.subject.namePlaceholder')}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t('onboarding.subject.exam')}</span>
        <input
          value={exam}
          onChange={(e) => setExam(e.target.value)}
          maxLength={60}
          className={field}
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t('onboarding.subject.when')}</span>
        {period && (
          <div className="flex gap-1.5">
            {[true, false].map((p) => (
              <button
                key={String(p)}
                type="button"
                aria-pressed={usePeriod === p}
                onClick={() => setUsePeriod(p)}
                className={cn(
                  'h-11 flex-1 rounded-full px-3 text-[13px] font-semibold',
                  usePeriod === p ? 'bg-ink text-white' : 'bg-white/50 text-ink',
                )}
              >
                {p ? t('onboarding.subject.fromCalendar') : t('onboarding.subject.exactDate')}
              </button>
            ))}
          </div>
        )}
        {period && usePeriod ? (
          <span className="rounded-[18px] glass px-4 py-3 text-[15px]">
            <span className="font-semibold">
              {dateRangeLabel(period.startsOn, period.endsOn, dateFnsLocales[locale])}
            </span>
            <span className="block text-xs text-ink-muted">{period.title}</span>
          </span>
        ) : (
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
        )}
      </div>
      <RoughSizeField value={size} onChange={setSize} />
    </>
  )
}
