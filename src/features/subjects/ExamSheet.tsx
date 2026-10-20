import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { usePeriods } from '@/features/schedule/api'
import { dateRangeLabel } from '@/features/schedule/format'
import { toPeriod } from '@/features/schedule/model'
import { useDayBoundary, useGlobalScale } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { localDay } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { examPeriodsFor, suggestExamPeriod, type Period } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useSaveScope, useScope, useSources } from '@/features/sources/api'
import { materialOf, toScopeRows } from '@/features/sources/model'
import { itemWorth } from '@/lib/grades'
import { useDeleteAssessment, useSaveAssessment, useSubject } from './api'
import { leavesOfPick, pickOf, rowsForLeaves, type SourcePick } from './sourceScope'
import { ExamSources } from './ExamSources'
import { ChipGroup, fieldInput, fieldLabel, NumberField, Segmented } from './fields'
import { examItem, formatPoints, gradeSubjectOf } from './grades'
import { PointsFields } from './PointsFields'
import { assessmentToForm } from './mappers'
import {
  ASSESSMENT_KINDS,
  EXAM_FORMATS,
  examKindDefaults,
  localDateOf,
  type Assessment,
} from './model'
import { EXAM_GRADE_DEFAULTS, examSheetSchema, type AssessmentForm } from './schemas'

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
  const globalScale = useGlobalScale()
  const save = useSaveAssessment()
  const saveScope = useSaveScope(subjectId)
  const { data: sources = [] } = useSources(subjectId)
  const { data: scope = [] } = useScope(subjectId)
  const materials = sources.map(materialOf).filter((m) => m.units.length > 0)
  /** Sources changed in step 2; the rest keep their saved rows. */
  const [touched, setTouched] = useState<Record<string, SourcePick>>({})
  const [step, setStep] = useState<1 | 2>(1)
  const navigate = useNavigate()
  const remove = useDeleteAssessment()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const form = useForm<AssessmentForm>({
    resolver: zodResolver(examSheetSchema),
    defaultValues: exam
      ? assessmentToForm(exam)
      : {
          id: crypto.randomUUID(),
          kind: 'final',
          title: t('exams.kind.final'),
          date: '',
          format: 'written',
          ...examKindDefaults('final'),
          dateTentative: false,
          dateLatest: null,
          examPeriodId: null,
          ...EXAM_GRADE_DEFAULTS,
        },
  })
  const [
    kind,
    examFormat,
    scopeAll,
    contingent,
    dateTentative,
    date,
    examPeriodId,
    pointsMax,
    pointsUnit,
    passMinPct,
    entryMinPoints,
    retakeOf,
  ] = useWatch({
    control: form.control,
    name: [
      'kind',
      'format',
      'scopeAll',
      'contingent',
      'dateTentative',
      'date',
      'examPeriodId',
      'pointsMax',
      'pointsUnit',
      'passMinPct',
      'entryMinPoints',
      'retakeOf',
    ],
  })
  const subject = useSubject(subjectId).data
  const pointsTotal = subject ? gradeSubjectOf(subject, globalScale).pointsTotal : 100
  const others = (subject?.assessments ?? []).filter((a) => a.id !== form.getValues('id'))
  const otherItems = others.map(examItem)
  const retakeTargets = others
    .filter((a) => a.kind !== 'makeup')
    .sort((a, b) => a.at.localeCompare(b.at))
  const retakeTarget = retakeTargets.find((a) => a.id === retakeOf)
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const periods = (usePeriods().data ?? []).map(toPeriod)
  const periodChoices = examPeriodsFor(kind, periods).filter((p) => p.endsOn >= today)
  const errors = form.formState.errors
  const set = { shouldDirty: true, shouldValidate: form.formState.isSubmitted } as const

  const examId = form.getValues('id')
  const scopeRows = toScopeRows(scope)
  const pickFor = (sourceId: string, all = scopeAll) => {
    const material = materials.find((m) => m.source.id === sourceId)!
    return touched[sourceId] ?? pickOf(material, { id: examId, scopeAll: all }, scopeRows)
  }
  const picks = Object.fromEntries(materials.map((m) => [m.source.id, pickFor(m.source.id)]))

  /** "Cijelo gradivo" changes what no rows mean, so every source keeps what it shows. */
  const setScopeAll = (value: boolean) => {
    setTouched(
      Object.fromEntries(
        materials.map((m) => [
          m.source.id,
          value
            ? { choice: 'all' as const, leaves: new Set<string>() }
            : pickFor(m.source.id, scopeAll),
        ]),
      ),
    )
    form.setValue('scopeAll', value, set)
  }

  const saveAll = async (values: AssessmentForm) => {
    // The exam row must exist before its scope rows (foreign key), so save in order.
    await save.mutateAsync({ subjectId, form: values })
    const examRef = { id: values.id, scopeAll: values.scopeAll }
    for (const [sourceId, pick] of Object.entries(touched)) {
      const material = materials.find((m) => m.source.id === sourceId)
      if (!material) continue
      await saveScope.mutateAsync({
        unitIds: material.units.map((u) => u.id),
        examIds: [values.id],
        rows: rowsForLeaves(material, examRef, leavesOfPick(material, pick)),
      })
    }
  }
  // Errors are all on step 1 fields.
  const showErrors = () => setStep(1)
  const submit = form.handleSubmit(async (values) => {
    onDone()
    await saveAll(values)
  }, showErrors)
  const next = async () => {
    if (await form.trigger()) setStep(2)
  }
  /** "Dodaj izvor" leaves the sheet, so the exam is saved first. */
  const addSource = form.handleSubmit(async (values) => {
    onDone()
    navigate(`/subjects/${subjectId}/sources/new`)
    await saveAll(values)
  }, showErrors)

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

  // A makeup carries its exam's points; an integral the partials' sum.
  const inheritedPoints = (() => {
    if (kind === 'makeup') {
      return retakeTarget ? itemWorth(examItem(retakeTarget), otherItems, pointsTotal) : null
    }
    if (kind !== 'integral') return null
    const partials = otherItems
      .filter((i) => i.kind === 'partial')
      .map((i) => itemWorth(i, otherItems, pointsTotal))
      .filter((w): w is number => w !== null)
    return partials.length > 0 ? partials.reduce((a, b) => a + b, 0) : null
  })()
  const { locale } = useLocale()
  const inherited =
    inheritedPoints === null
      ? undefined
      : {
          points: inheritedPoints,
          hint:
            kind === 'makeup'
              ? t('grades.fields.makeupCarries', {
                  title: retakeTarget?.title,
                  points: formatPoints(inheritedPoints, locale),
                })
              : t('grades.fields.integralCarries'),
        }

  const pickRetake = (id: string) => {
    const previous = retakeTargets.find((a) => a.id === form.getValues('retakeOf'))
    form.setValue('retakeOf', id, set)
    const target = retakeTargets.find((a) => a.id === id)
    if (!target) return
    // A makeup repeats the exam's threshold unless one is set.
    if (form.getValues('passMinPct') === null) {
      form.setValue('passMinPct', target.pass_min_pct, set)
    }
    const title = form.getValues('title').trim()
    const auto = (title: string | undefined) => t('exams.makeupTitle', { title })
    if (!title || title === t('exams.kind.makeup') || title === auto(previous?.title)) {
      form.setValue('title', auto(target.title), set)
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
      <Segmented
        label={t('exams.steps.label')}
        options={([1, 2] as const).map((n) => ({
          value: String(n) as '1' | '2',
          label: t(`exams.steps.${n}`, { n }),
        }))}
        value={String(step) as '1' | '2'}
        onChange={(v) => (v === '2' ? next() : setStep(1))}
      />
      {step === 2 ? (
        <ExamSources
          materials={materials}
          picks={picks}
          onPick={(id, pick) => setTouched((prev) => ({ ...prev, [id]: pick }))}
          scopeAll={scopeAll}
          onScopeAll={setScopeAll}
          onAddSource={addSource}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className={fieldLabel}>{t('exams.kindLabel')}</span>
            <ChipGroup
              options={ASSESSMENT_KINDS.map((k) => ({ value: k, label: t(`exams.kind.${k}`) }))}
              value={kind}
              onChange={pickKind}
            />
          </div>

          {kind === 'makeup' && (
            <div className="flex flex-col gap-2">
              <span className={fieldLabel}>{t('exams.retakeOf')}</span>
              {retakeTargets.length > 0 ? (
                <ChipGroup
                  options={retakeTargets.map((a) => ({ value: a.id, label: a.title }))}
                  value={retakeOf}
                  onChange={pickRetake}
                />
              ) : (
                <span className="text-xs leading-[1.4] text-ink-muted">
                  {t('exams.retakeOfNone')}
                </span>
              )}
              {errors.retakeOf && (
                <span role="alert" className="text-sm text-danger">
                  {t(validationKey(errors.retakeOf.message))}
                </span>
              )}
            </div>
          )}

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

          <PointsFields
            value={{ pointsMax, pointsUnit, passMinPct }}
            onChange={(patch) => {
              if (patch.pointsMax !== undefined) form.setValue('pointsMax', patch.pointsMax, set)
              if (patch.pointsUnit) form.setValue('pointsUnit', patch.pointsUnit, set)
              if (patch.passMinPct !== undefined) form.setValue('passMinPct', patch.passMinPct, set)
            }}
            pointsTotal={pointsTotal}
            inherited={inherited}
            thresholdHint={t('grades.fields.thresholdHintExam')}
            errors={{
              pointsMax: errors.pointsMax && validationKey(errors.pointsMax.message),
              passMinPct: errors.passMinPct && validationKey(errors.passMinPct.message),
            }}
          />
          <div className="flex flex-col gap-2">
            <span className={fieldLabel}>
              {t('grades.fields.entry')}{' '}
              <span className="font-normal text-ink-muted">{t('deadlines.optional')}</span>
            </span>
            <NumberField
              label={t('grades.fields.entry')}
              placeholder={t('grades.fields.entryPlaceholder')}
              value={entryMinPoints}
              invalid={Boolean(errors.entryMinPoints)}
              onChange={(n) => form.setValue('entryMinPoints', n === 0 ? null : n, set)}
            />
            <span className="text-xs leading-[1.4] text-ink-muted">
              {t('grades.fields.entryHint')}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <span className={fieldLabel}>{t('subjects.form.examFormat')}</span>
            <ChipGroup
              options={EXAM_FORMATS.map((f) => ({ value: f, label: t(`subjects.format.${f}`) }))}
              value={examFormat}
              onChange={(f) => form.setValue('format', f, set)}
            />
          </div>

          <Switch
            checked={contingent}
            label={t('subjects.form.contingent')}
            onChange={(v) => form.setValue('contingent', v, set)}
          />
        </>
      )}

      {step === 1 && !exam ? (
        <Button
          type="button"
          size="pill"
          className="bg-brand text-white hover:bg-brand-strong"
          onClick={next}
        >
          {t('exams.steps.next')}
        </Button>
      ) : (
        <Button type="submit" size="pill" className="bg-brand text-white hover:bg-brand-strong">
          {t('common.save')}
        </Button>
      )}
      {step === 2 && (
        <Button type="button" variant="link" className="h-11" onClick={() => setStep(1)}>
          {t('exams.steps.back')}
        </Button>
      )}
      {exam && step === 1 && (
        <Link
          to={`/plan?view=day&date=${localDateOf(exam.at)}`}
          className="flex h-11 items-center justify-center text-sm font-semibold text-brand"
        >
          {t('exams.showInCalendar')}
        </Link>
      )}
      {exam && step === 1 && (
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
