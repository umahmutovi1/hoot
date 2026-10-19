import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { usePeriods } from '@/features/schedule/api'
import { dateRangeLabel } from '@/features/schedule/format'
import { toPeriod } from '@/features/schedule/model'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { localDay } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { examPeriodsFor, suggestExamPeriod, type Period } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useSaveScope, useSources } from '@/features/sources/api'
import { materialOf } from '@/features/sources/model'
import { useDeleteAssessment, useSaveAssessment } from './api'
import { rowsForSource, type SourceChoice } from './sourceScope'
import { ExamSources } from './ExamSources'
import { ChipGroup, fieldInput, fieldLabel } from './fields'
import { assessmentToForm } from './mappers'
import {
  ASSESSMENT_KINDS,
  EXAM_FORMATS,
  examKindDefaults,
  localDateOf,
  type Assessment,
} from './model'
import { assessmentFormSchema, type AssessmentForm } from './schemas'

/** How the exam's date is known: exact day, "in a period" of the academic calendar, or a range. */
const DATE_MODES = ['exact', 'period', 'range'] as const
type DateMode = (typeof DATE_MODES)[number]

interface ExamSheetProps {
  subjectId: string
  /** Exam to edit; undefined = new exam. */
  exam?: Assessment
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExamSheet({ subjectId, exam, open, onOpenChange }: ExamSheetProps) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(exam ? 'exams.editTitle' : 'exams.newTitle')}
    >
      {open && <ExamForm subjectId={subjectId} exam={exam} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function ExamForm({
  subjectId,
  exam,
  onDone,
}: {
  subjectId: string
  exam?: Assessment
  onDone: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveAssessment()
  const saveScope = useSaveScope(subjectId)
  const { data: sources = [] } = useSources(subjectId)
  const [sourceChoices, setSourceChoices] = useState<Record<string, SourceChoice>>({})
  const remove = useDeleteAssessment()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const form = useForm<AssessmentForm>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: exam
      ? assessmentToForm(exam)
      : {
          id: crypto.randomUUID(),
          kind: 'final',
          title: '',
          date: '',
          format: 'written',
          ...examKindDefaults('final'),
          dateTentative: false,
          dateLatest: null,
          examPeriodId: null,
        },
  })
  const [kind, examFormat, scopeAll, contingent, dateTentative, date, examPeriodId] = useWatch({
    control: form.control,
    name: ['kind', 'format', 'scopeAll', 'contingent', 'dateTentative', 'date', 'examPeriodId'],
  })
  const { locale } = useLocale()
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const periods = (usePeriods().data ?? []).map(toPeriod)
  const periodChoices = examPeriodsFor(kind, periods).filter((p) => p.endsOn >= today)
  const errors = form.formState.errors
  const set = { shouldDirty: true, shouldValidate: form.formState.isSubmitted } as const

  const submit = form.handleSubmit(async (values) => {
    onDone()
    // The exam row must exist before its scope rows (foreign key), so save in order.
    await save.mutateAsync({ subjectId, form: values })
    const examRef = { id: values.id, scopeAll: values.scopeAll }
    for (const [sourceId, choice] of Object.entries(sourceChoices)) {
      const material = sources.map(materialOf).find((m) => m.source.id === sourceId)
      if (!material) continue
      await saveScope.mutateAsync({
        unitIds: material.units.map((u) => u.id),
        examIds: [values.id],
        rows: rowsForSource(material, examRef, choice),
      })
    }
  })

  /** "U roku": the tentative range becomes the exam period. */
  const applyPeriod = (p: Period | undefined) => {
    form.setValue('examPeriodId', p?.id ?? null, set)
    if (!p) return
    form.setValue('date', p.startsOn, set)
    form.setValue('dateLatest', p.endsOn, set)
  }

  const mode: DateMode = !dateTentative ? 'exact' : examPeriodId ? 'period' : 'range'
  const setMode = (m: DateMode) => {
    form.setValue('dateTentative', m !== 'exact', set)
    if (m === 'period') {
      applyPeriod(
        periodChoices.find((p) => p.id === examPeriodId) ??
          suggestExamPeriod(kind, periods, today) ??
          periodChoices[0],
      )
    } else {
      form.setValue('examPeriodId', null, set)
    }
  }

  const pickKind = (k: AssessmentForm['kind']) => {
    const previous = form.getValues('kind')
    form.setValue('kind', k, set)
    const defaults = examKindDefaults(k)
    form.setValue('scopeAll', defaults.scopeAll, set)
    form.setValue('contingent', defaults.contingent, set)
    // Follow the type in the name until the user writes their own.
    const title = form.getValues('title').trim()
    if (!title || title === t(`exams.kind.${previous}`)) {
      form.setValue('title', t(`exams.kind.${k}`), set)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('exams.kindLabel')}</span>
        <ChipGroup
          options={ASSESSMENT_KINDS.map((k) => ({ value: k, label: t(`exams.kind.${k}`) }))}
          value={kind}
          onChange={pickKind}
        />
      </div>

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('subjects.form.examTitle')}</span>
        <input
          maxLength={60}
          placeholder={t('subjects.form.examTitlePlaceholder')}
          aria-invalid={Boolean(errors.title)}
          className={fieldInput}
          {...form.register('title')}
        />
        {errors.title && (
          <span role="alert" className="text-sm text-danger">
            {t(validationKey(errors.title.message))}
          </span>
        )}
      </label>

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('exams.dateMode.label')}</span>
        <ChipGroup
          options={DATE_MODES.filter((m) => m !== 'period' || periodChoices.length > 0).map(
            (m) => ({ value: m, label: t(`exams.dateMode.${m}`) }),
          )}
          value={mode}
          onChange={setMode}
        />
        {mode === 'period' && (
          <div role="radiogroup" className="flex flex-col gap-1.5">
            {periodChoices.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={examPeriodId === p.id}
                onClick={() => applyPeriod(p)}
                className={cn(
                  'flex min-h-12 items-center justify-between gap-3 rounded-[16px] px-4 py-2 text-left',
                  examPeriodId === p.id ? 'bg-brand text-white' : 'bg-canvas',
                )}
              >
                <span className="text-sm font-semibold">{p.title}</span>
                <span
                  className={cn(
                    'text-xs',
                    examPeriodId === p.id ? 'text-white/80' : 'text-ink-muted',
                  )}
                >
                  {dateRangeLabel(p.startsOn, p.endsOn, dateFnsLocales[locale])}
                </span>
              </button>
            ))}
          </div>
        )}
        {mode !== 'period' && (
          <div className={cn('grid gap-2', dateTentative && 'grid-cols-2')}>
            <label className="flex min-w-0 flex-col gap-2">
              <span className={fieldLabel}>
                {t(dateTentative ? 'subjects.form.rangeEarliest' : 'subjects.form.examDate')}
              </span>
              <input
                type="date"
                aria-invalid={Boolean(errors.date)}
                className={cn(fieldInput, dateTentative && 'px-3')}
                {...form.register('date', {
                  onChange: () => form.setValue('examPeriodId', null, set),
                })}
              />
            </label>
            {dateTentative && (
              <label className="flex min-w-0 flex-col gap-2">
                <span className={fieldLabel}>{t('subjects.form.rangeLatest')}</span>
                <input
                  type="date"
                  min={date || undefined}
                  aria-invalid={Boolean(errors.dateLatest)}
                  className={cn(fieldInput, 'px-3')}
                  {...form.register('dateLatest', {
                    setValueAs: (v: string) => v || null,
                    onChange: () => form.setValue('examPeriodId', null, set),
                  })}
                />
              </label>
            )}
          </div>
        )}
        {dateTentative && (
          <span className="text-xs leading-[1.4] text-ink-muted">{t('exams.rangeHint')}</span>
        )}
        {(errors.date || errors.dateLatest) && (
          <span role="alert" className="text-sm text-danger">
            {t(validationKey(errors.date?.message ?? errors.dateLatest?.message))}
          </span>
        )}
      </div>

      <ExamSources
        subjectId={subjectId}
        exam={{ id: form.getValues('id'), scopeAll }}
        choices={sourceChoices}
        onChange={(id, c) => setSourceChoices((prev) => ({ ...prev, [id]: c }))}
        isNew={!exam}
      />

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('subjects.form.examFormat')}</span>
        <ChipGroup
          options={EXAM_FORMATS.map((f) => ({ value: f, label: t(`subjects.format.${f}`) }))}
          value={examFormat}
          onChange={(f) => form.setValue('format', f, set)}
        />
      </div>

      <div className="flex flex-col">
        <Switch
          checked={scopeAll}
          label={t('exams.scopeAll')}
          onChange={(v) => form.setValue('scopeAll', v, set)}
        />
        <Switch
          checked={contingent}
          label={t('subjects.form.contingent')}
          onChange={(v) => form.setValue('contingent', v, set)}
        />
      </div>

      <Button type="submit" size="pill" className="bg-brand text-white hover:bg-brand-strong">
        {t('common.save')}
      </Button>
      {exam && (
        <Link
          to={`/plan?view=day&date=${localDateOf(exam.at)}`}
          className="flex h-11 items-center justify-center text-sm font-semibold text-brand"
        >
          {t('exams.showInCalendar')}
        </Link>
      )}
      {exam && (
        <Button
          type="button"
          variant="link"
          className="h-11 text-danger"
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            remove.mutate(exam.id)
            onDone()
          }}
        >
          {t(confirmDelete ? 'exams.confirmDelete' : 'exams.delete')}
        </Button>
      )}
    </form>
  )
}
