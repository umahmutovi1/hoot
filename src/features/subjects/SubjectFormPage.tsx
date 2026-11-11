import { useCreateRoughSource } from '@/features/sources/api'
import { SemesterField } from '@/features/academic/SemesterField'
import { useAcademicTerm } from '@/features/academic/api'
import { useRoughTexts } from './roughTexts'
import { useState, type ReactNode } from 'react'
import { useFieldArray, useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
  CalendarIcon,
  CameraIcon,
  ChevronDownIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  DocIcon,
  PlusIcon,
} from '@/components/icons'
import { InHeader } from '@/app/layout/ScreenHeader'
import { RadioCard } from '@/components/RadioCard'
import { SplashScreen } from '@/components/SplashScreen'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { usePeriods } from '@/features/schedule/api'
import { toPeriod } from '@/features/schedule/model'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { usePlanStore } from '@/features/plan/store'
import { GRADES } from '@/lib/grades'
import { isConditional, priorityFromGoal } from '@/lib/scheduler'
import { localDay } from '@/lib/day'
import { assignExamPeriods, type Period } from '@/lib/schedule'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useArchiveSubject, useSaveSubject, useSubject, useSubjects } from './api'
import { ColorSwatch } from './fields'
import { subjectToForm } from './mappers'
import { EXAM_FORMATS, examKindDefaults, SUBJECT_COLORS } from './model'
import { EXAM_PRESETS, presetExams, type ExamPreset } from './presets'
import {
  EXAM_GRADE_DEFAULTS,
  subjectFormSchema,
  type AssessmentForm,
  type SubjectForm,
} from './schemas'

const sectionLabel = 'text-sm font-semibold'
const chip = 'flex h-9 items-center rounded-[12px] bg-canvas px-3 text-[13px]'

/** NoviPredmet / NoviPredmetNapredno: create a subject, or edit one at /subjects/:id/edit. */
export function SubjectFormPage() {
  const { id } = useParams()
  const { data: subject, isPending } = useSubject(id)

  if (!id) return <SubjectForm />
  if (isPending) return <SplashScreen />
  if (!subject) return <Navigate to="/subjects" replace />
  return <SubjectForm initial={subjectToForm(subject)} archived={subject.archived} />
}

function SubjectForm({ initial, archived }: { initial?: SubjectForm; archived?: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSaveSubject()
  const archive = useArchiveSubject()
  const isEdit = Boolean(initial)
  const [preset, setPreset] = useState<ExamPreset>('partials')
  const [params] = useSearchParams()
  // "Uredi" on the subject's Cilj card opens the form with Napredno open.
  const [advancedOpen, setAdvancedOpen] = useState(params.get('goal') === '1')
  // NoviPredmet → Prvi izvor: where "Kreiraj predmet" continues (the source editor's mode).
  const [firstSource, setFirstSource] = useState<FirstSource>('pdf')
  const { data: subjects = [] } = useSubjects()
  // The next free colour, so a new subject needs no choice (like a quick subject).
  const [freeColor] = useState(
    () => SUBJECT_COLORS.find((c) => !subjects.some((x) => x.color === c)) ?? 'pink',
  )
  const createRough = useCreateRoughSource()
  const roughTexts = useRoughTexts()
  const { defaultTerm } = useAcademicTerm()

  const newExams = (p: ExamPreset): AssessmentForm[] =>
    presetExams(p).map((e) => ({
      id: crypto.randomUUID(),
      kind: e.kind,
      title: t(`subjects.examTitle.${e.titleKey}`),
      date: '',
      format: 'written',
      scopeAll: e.scopeAll,
      contingent: e.contingent,
      dateTentative: false,
      dateLatest: null,
      examPeriodId: null,
      ...EXAM_GRADE_DEFAULTS,
    }))

  const form = useForm<SubjectForm>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: initial ?? {
      id: crypto.randomUUID(),
      name: '',
      color: freeColor,
      priority: 3,
      studyMode: 'regular',
      campaignStartOn: null,
      targetGrade: null,
      assessments: newExams('partials'),
    },
  })
  const exams = useFieldArray({ control: form.control, name: 'assessments', keyName: 'key' })
  const [color, studyMode, academicYearId, semesterNo] = useWatch({
    control: form.control,
    name: ['color', 'studyMode', 'academicYearId', 'semesterNo'],
  })
  const nameError = form.formState.errors.name?.message
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const periods = (usePeriods().data ?? []).map(toPeriod)
  const watchedExams = useWatch({ control: form.control, name: 'assessments' })
  const suggested = assignExamPeriods(watchedExams, periods, today)
  const canUsePeriods = watchedExams.some((e, i) => !e.date && suggested[i])

  /** Exams without a date get the range of the matching period from the academic calendar. */
  const applyPeriodsToUndated = () => {
    watchedExams.forEach((e, i) => {
      const p = suggested[i]
      if (e.date || !p) return
      const set = { shouldDirty: true } as const
      form.setValue(`assessments.${i}.dateTentative`, true, set)
      form.setValue(`assessments.${i}.date`, p.startsOn, set)
      form.setValue(`assessments.${i}.dateLatest`, p.endsOn, set)
      form.setValue(`assessments.${i}.examPeriodId`, p.id, set)
    })
  }

  const pickPreset = (p: ExamPreset) => {
    setPreset(p)
    exams.replace(newExams(p))
  }

  const addExam = () => {
    const kind = exams.fields.length === 0 ? 'final' : 'other'
    exams.append({
      id: crypto.randomUUID(),
      kind,
      title: '',
      date: '',
      format: 'written',
      ...examKindDefaults(kind),
      dateTentative: false,
      dateLatest: null,
      examPeriodId: null,
      ...EXAM_GRADE_DEFAULTS,
    })
  }

  /** Saves; a new subject goes on to its first source, or gets the rough ~25 h one ("kasnije"). */
  const submit = (later: boolean) =>
    form.handleSubmit((values) => {
      // A new subject without a picked semester gets the current one.
      const term = values.academicYearId === undefined ? (defaultTerm ?? {}) : {}
      const rough = !isEdit && later
      // The rough source needs the subject row first.
      void save.mutateAsync({ ...values, ...term }).then(() => {
        if (rough)
          createRough.mutate({ subjectId: values.id, size: 'medium', ...roughTexts('medium') })
      })
      navigate(
        isEdit || later
          ? `/subjects/${values.id}`
          : `/subjects/${values.id}/sources/new?mode=${firstSource}`,
        { replace: true },
      )
    })

  const toggleArchive = () => {
    archive.mutate({ id: initial!.id, archived: !archived })
    navigate('/subjects', { replace: true })
  }

  return (
    <form onSubmit={submit(false)} noValidate className="flex flex-1 flex-col gap-4">
      <InHeader>
        <h1 className="text-[36px] leading-[1.02] font-bold">
          {t(isEdit ? 'subjects.form.editTitle' : 'subjects.form.newTitle')}
        </h1>
        <p className="mt-2 text-[15px] text-ground/85">
          {t(isEdit ? 'subjects.form.editSub' : 'subjects.form.newSub')}
        </p>
      </InHeader>

      <label className="flex flex-col gap-2">
        <span className={sectionLabel}>{t('subjects.form.name')}</span>
        <input
          autoFocus={!isEdit}
          maxLength={80}
          placeholder={t('subjects.form.namePlaceholder')}
          aria-invalid={Boolean(nameError)}
          className="h-[54px] rounded-input border-2 border-transparent surface px-4 text-base outline-none focus-visible:border-brand-accent aria-invalid:border-danger"
          {...form.register('name')}
        />
        {nameError && (
          <span role="alert" className="text-sm text-danger">
            {t(validationKey(nameError))}
          </span>
        )}
      </label>

      <div className="flex flex-col gap-2">
        <span className={sectionLabel}>{t('subjects.form.color')}</span>
        <div role="radiogroup" aria-label={t('subjects.form.color')} className="flex gap-2.5">
          {SUBJECT_COLORS.map((c) => (
            <ColorSwatch
              key={c}
              color={c}
              checked={color === c}
              onSelect={() => form.setValue('color', c, { shouldDirty: true })}
            />
          ))}
        </div>
      </div>

      <SemesterField
        value={
          academicYearId === undefined
            ? (defaultTerm ?? { academicYearId: null, semesterNo: null })
            : { academicYearId, semesterNo: semesterNo ?? null }
        }
        onChange={(term) => {
          form.setValue('academicYearId', term.academicYearId, { shouldDirty: true })
          form.setValue('semesterNo', term.semesterNo, { shouldDirty: true })
        }}
      />

      {!isEdit && (
        <div className="flex flex-col gap-2">
          <span className={sectionLabel}>{t('subjects.form.howExamined')}</span>
          <div role="radiogroup" className="flex flex-col gap-2">
            {EXAM_PRESETS.map((p) => (
              <RadioCard
                key={p}
                checked={preset === p}
                title={t(`subjects.preset.${p}.title`)}
                subtitle={t(`subjects.preset.${p}.sub`)}
                onSelect={() => pickPreset(p)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className={sectionLabel}>{t('subjects.form.exams')}</span>
        {canUsePeriods && (
          <button
            type="button"
            onClick={applyPeriodsToUndated}
            className="flex items-center gap-3 rounded-[20px] bg-brand-soft px-4 py-3 text-left"
          >
            <CalendarIcon size={20} className="shrink-0 text-brand" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-brand-strong">
                {t('subjects.form.usePeriodsTitle')}
              </span>
              <span className="text-xs text-avatar-ink">{t('subjects.form.usePeriodsBody')}</span>
            </span>
          </button>
        )}
        {exams.fields.map((field, index) => (
          <ExamEditor
            key={field.key}
            index={index}
            control={form.control}
            register={form.register}
            setValue={(name, value) =>
              form.setValue(`assessments.${index}.${name}`, value, { shouldDirty: true })
            }
            errors={form.formState.errors.assessments?.[index]}
            periodTitle={periods.find((p) => p.id === watchedExams[index]?.examPeriodId)?.title}
            periods={periods.filter((p) => p.kind === 'exam' && p.endsOn >= today)}
            onDateMode={(value) => {
              const set = { shouldDirty: true } as const
              const period = periods.find((p) => `p:${p.id}` === value)
              form.setValue(`assessments.${index}.dateTentative`, value !== 'exact', set)
              form.setValue(`assessments.${index}.examPeriodId`, period?.id ?? null, set)
              if (period) {
                form.setValue(`assessments.${index}.date`, period.startsOn, set)
                form.setValue(`assessments.${index}.dateLatest`, period.endsOn, set)
              }
            }}
            clearPeriod={() =>
              form.setValue(`assessments.${index}.examPeriodId`, null, { shouldDirty: true })
            }
            onRemove={() => exams.remove(index)}
          />
        ))}
        <button
          type="button"
          onClick={addExam}
          className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-dashed border-line text-sm font-semibold text-brand"
        >
          <PlusIcon size={16} />
          {t('subjects.form.addExam')}
        </button>
        <span className="px-1 text-xs text-ink-muted">{t('subjects.form.scopeLater')}</span>
      </div>

      <GoalFields control={form.control} setValue={form.setValue} />

      {!isEdit && <FirstSourceField value={firstSource} onChange={setFirstSource} />}

      <div className="flex flex-col rounded-card surface">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
          className="flex min-h-16 items-center gap-3 p-4 text-left"
        >
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t('subjects.form.advanced')}</span>
            <span className="text-[13px] text-ink-muted">
              {t(`subjects.goal.modeShort.${studyMode}`)}
            </span>
          </span>
          <ChevronDownIcon
            size={20}
            className={cn('text-ink-muted transition-transform', advancedOpen && 'rotate-180')}
          />
        </button>
        {advancedOpen && (
          <AdvancedFields
            control={form.control}
            setValue={form.setValue}
            subjectId={isEdit ? form.getValues('id') : null}
          />
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        <Button type="submit" size="pill" className="btn-primary">
          {t(isEdit ? 'common.save' : 'subjects.form.create')}
        </Button>
        {!isEdit && (
          <>
            <Button
              type="button"
              variant="link"
              className="h-12 font-bold text-brand-strong"
              onClick={() => void submit(true)()}
            >
              {t('subjects.firstSource.later')}
            </Button>
            <span className="px-1 text-center text-[13px] text-ink-secondary">
              {t('subjects.firstSource.laterHint')}
            </span>
          </>
        )}
        {isEdit && (
          <Button type="button" variant="link" className="h-12 text-ink" onClick={toggleArchive}>
            {t(archived ? 'subjects.form.unarchive' : 'subjects.form.archive')}
          </Button>
        )}
      </div>
    </form>
  )
}

type ExamField = 'title' | 'date' | 'format' | 'contingent' | 'dateTentative'

function ExamEditor({
  index,
  control,
  register,
  setValue,
  errors,
  periodTitle,
  periods,
  onDateMode,
  clearPeriod,
  onRemove,
}: {
  index: number
  control: Control<SubjectForm>
  register: ReturnType<typeof useForm<SubjectForm>>['register']
  setValue: (name: ExamField, value: boolean) => void
  errors?: {
    title?: { message?: string }
    date?: { message?: string }
    dateLatest?: { message?: string }
  }
  /** Exam period the tentative range comes from ("U roku: …"). */
  periodTitle?: string
  /** Exam periods of the academic calendar the exam can be "in". */
  periods: Period[]
  /** 'exact' | 'range' | 'p:<periodId>' */
  onDateMode: (value: string) => void
  clearPeriod: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const exam = useWatch({ control, name: `assessments.${index}` })
  const error = errors?.title?.message ?? errors?.date?.message ?? errors?.dateLatest?.message
  const dayLabel = (date: string | null) =>
    date
      ? format(new Date(`${date}T12:00`), 'd. MMM', { locale: dateFnsLocales[locale] })
      : t('subjects.form.pickDate')
  const scope = [
    t(exam.scopeAll ? 'subjects.scope.all' : 'subjects.scope.part'),
    exam.contingent && t('subjects.form.notPlannedAhead'),
    exam.dateTentative &&
      (periodTitle
        ? t('subjects.form.inPeriod', { title: periodTitle })
        : t('subjects.form.dateNotConfirmed')),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-1 rounded-[20px] surface px-4 pt-3.5 pb-1.5">
      <div className="flex items-center gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <input
            aria-label={t('subjects.form.examTitle')}
            placeholder={t('subjects.form.examTitlePlaceholder')}
            maxLength={60}
            className="min-w-0 bg-transparent text-[15px] font-semibold outline-none placeholder:text-ink-placeholder"
            {...register(`assessments.${index}.title`)}
          />
          <span className="truncate text-xs text-ink-muted">{scope}</span>
        </div>
        {!exam.dateTentative && (
          <DateChip label={dayLabel(exam.date)}>
            <input
              type="date"
              aria-label={t('subjects.form.examDate')}
              className="absolute inset-0 opacity-0"
              {...register(`assessments.${index}.date`)}
            />
          </DateChip>
        )}
        <select
          aria-label={t('subjects.form.examFormat')}
          className={cn(chip, 'appearance-none px-2.5')}
          {...register(`assessments.${index}.format`)}
        >
          {EXAM_FORMATS.map((f) => (
            <option key={f} value={f}>
              {t(`subjects.format.${f}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('subjects.form.removeExam')}
          className="-mr-2 flex size-11 shrink-0 items-center justify-center text-ink-muted"
        >
          <CloseIcon size={16} />
        </button>
      </div>
      {exam.dateTentative && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[13px] text-ink-muted">
          {t('subjects.form.rangeBetween')}
          <DateChip label={dayLabel(exam.date)}>
            <input
              type="date"
              aria-label={t('subjects.form.rangeEarliest')}
              className="absolute inset-0 opacity-0"
              {...register(`assessments.${index}.date`, { onChange: clearPeriod })}
            />
          </DateChip>
          {t('subjects.form.rangeAnd')}
          <DateChip label={dayLabel(exam.dateLatest)}>
            <input
              type="date"
              aria-label={t('subjects.form.rangeLatest')}
              min={exam.date || undefined}
              className="absolute inset-0 opacity-0"
              {...register(`assessments.${index}.dateLatest`, {
                setValueAs: (v: string) => v || null,
                onChange: clearPeriod,
              })}
            />
          </DateChip>
        </div>
      )}
      {error && (
        <span role="alert" className="text-xs text-danger">
          {t(validationKey(error))}
        </span>
      )}
      <div className="flex flex-wrap gap-x-[18px]">
        <Switch
          checked={exam.contingent}
          label={t('subjects.form.contingent')}
          onChange={(v) => setValue('contingent', v)}
        />
        <span className="relative my-1 inline-flex self-start">
          <select
            aria-label={t('exams.dateMode.label')}
            value={
              exam.examPeriodId ? `p:${exam.examPeriodId}` : exam.dateTentative ? 'range' : 'exact'
            }
            onChange={(e) => onDateMode(e.target.value)}
            className={cn(chip, 'h-10 appearance-none pr-8 font-semibold')}
          >
            <option value="exact">{t('exams.dateMode.exact')}</option>
            {periods.map((p) => (
              <option key={p.id} value={`p:${p.id}`}>
                {t('subjects.form.inPeriodOption', { title: p.title })}
              </option>
            ))}
            <option value="range">{t('exams.dateMode.range')}</option>
          </select>
          <ChevronDownIcon
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
          />
        </span>
      </div>
    </div>
  )
}

function DateChip({ label, children }: { label: string; children: ReactNode }) {
  // The native date input sits invisibly on top, so the system date picker opens on tap.
  return (
    <label className={cn(chip, 'relative font-semibold text-ink')}>
      {label}
      {children}
    </label>
  )
}

function AdvancedFields({
  control,
  setValue,
  subjectId,
}: {
  control: Control<SubjectForm>
  setValue: ReturnType<typeof useForm<SubjectForm>>['setValue']
  /** Saved subject (edit): its computed campaign start comes from the plan. */
  subjectId: string | null
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [studyMode, campaignStartOn] = useWatch({
    control,
    name: ['studyMode', 'campaignStartOn'],
  })
  const computed = usePlanStore((s) =>
    subjectId ? s.model?.result.computedStarts[subjectId] : undefined,
  )
  const set = { shouldDirty: true } as const
  const date = (d: string) =>
    format(new Date(`${d}T12:00`), 'd. MMM', { locale: dateFnsLocales[locale] })

  return (
    <div className="flex flex-col gap-3 border-t border-canvas px-4 pt-3.5 pb-[18px]">
      <span className="text-[15px] font-semibold">{t('subjects.goal.when')}</span>
      <div role="radiogroup" className="flex flex-col gap-2">
        {(['regular', 'campaign'] as const).map((m) => (
          <RadioCard
            key={m}
            checked={studyMode === m}
            title={t(`subjects.goal.mode.${m}.title`)}
            subtitle={t(`subjects.goal.mode.${m}.sub`)}
            onSelect={() => {
              setValue('studyMode', m, set)
              if (m === 'regular') setValue('campaignStartOn', null, set)
            }}
            className={cn('rounded-[18px]', studyMode === m ? 'bg-canvas-soft' : 'border-hairline')}
          />
        ))}
      </div>

      {studyMode === 'campaign' && (
        <>
          <div className="flex items-center gap-2.5 rounded-[18px] bg-canvas-soft py-2.5 pr-2 pl-3.5">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-xs text-ink-muted">{t('subjects.form.campaignStart')}</span>
              <span className="text-[15px] font-semibold">
                {campaignStartOn
                  ? t('subjects.form.campaignStartManual', { date: date(campaignStartOn) })
                  : computed
                    ? t('subjects.goal.computedOn', { date: date(computed) })
                    : t('subjects.form.campaignStartComputed')}
              </span>
            </span>
            {campaignStartOn ? (
              <button
                type="button"
                onClick={() => setValue('campaignStartOn', null, set)}
                className="min-h-11 px-2.5 text-sm font-semibold text-brand"
              >
                {t('subjects.form.useComputed')}
              </button>
            ) : (
              <label className="relative flex min-h-11 items-center px-2.5 text-sm font-semibold text-brand">
                {t('subjects.form.setManually')}
                <input
                  type="date"
                  aria-label={t('subjects.form.campaignStart')}
                  className="absolute inset-0 opacity-0"
                  onChange={(e) => setValue('campaignStartOn', e.target.value || null, set)}
                />
              </label>
            )}
          </div>
          <span className="text-xs leading-[1.4] text-ink-muted">
            {t('subjects.form.campaignHint')}
          </span>
        </>
      )}
    </div>
  )
}

type FirstSource = 'pdf' | 'photo'

/**
 * Cilj (PRD "Dopune, 5. nov 2026"): "Uslovni predmet" and the optional target grade instead of
 * "Koliko ti je bitan". Changing either sets the priority through `priorityFromGoal()`; a manual
 * priority from before stays until then.
 */
function GoalFields({
  control,
  setValue,
}: {
  control: Control<SubjectForm>
  setValue: ReturnType<typeof useForm<SubjectForm>>['setValue']
}) {
  const { t } = useTranslation()
  const [priority, targetGrade] = useWatch({ control, name: ['priority', 'targetGrade'] })
  const conditional = isConditional(priority)
  const set = { shouldDirty: true } as const
  const apply = (goal: { conditional: boolean; targetGrade: number | null }) => {
    setValue('targetGrade', goal.targetGrade, set)
    setValue('priority', priorityFromGoal(goal), set)
  }
  const hint =
    targetGrade === null
      ? t('subjects.goal.targetHint.none')
      : targetGrade <= 6
        ? t('subjects.goal.targetHint.low')
        : targetGrade <= 8
          ? t('subjects.goal.targetHint.mid', { grade: targetGrade })
          : t('subjects.goal.targetHint.high', { grade: targetGrade })

  return (
    <>
      <div className="surface flex min-h-[72px] items-center gap-3 rounded-card py-2 pr-3 pl-4">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">{t('subjects.form.conditional')}</span>
          <span className="text-[13px] leading-[1.35] text-ink-secondary">
            {t('subjects.form.conditionalSub')}
          </span>
        </span>
        <Switch
          checked={conditional}
          label={t('subjects.form.conditional')}
          hideLabel
          onChange={(on) => apply({ conditional: on, targetGrade })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="px-1 text-sm font-bold">
          {t('subjects.goal.target')}{' '}
          <span className="font-medium text-ink-secondary">{t('subjects.goal.optional')}</span>
        </span>
        <div
          role="radiogroup"
          aria-label={t('subjects.goal.target')}
          className="grid grid-cols-5 gap-2"
        >
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={targetGrade === g}
              onClick={() => apply({ conditional, targetGrade: targetGrade === g ? null : g })}
              className={cn(
                'h-11 rounded-[14px] text-sm font-bold',
                targetGrade === g ? 'bg-brand text-ground' : 'surface',
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <span className="px-1 text-[13px] leading-[1.4] text-ink-secondary">{hint}</span>
      </div>
    </>
  )
}

/** NoviPredmet → Prvi izvor: a PDF or a photo of the contents instead of guessing the size. */
function FirstSourceField({
  value,
  onChange,
}: {
  value: FirstSource
  onChange: (v: FirstSource) => void
}) {
  const { t } = useTranslation()
  const options: { id: FirstSource; tile: string; icon: ReactNode }[] = [
    { id: 'pdf', tile: 'bg-subject-blue-soft text-subject-blue-ink', icon: <DocIcon size={20} /> },
    { id: 'photo', tile: 'bg-ai-soft text-warning-ink', icon: <CameraIcon size={20} /> },
  ]
  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-sm font-bold">{t('subjects.firstSource.title')}</span>
      <div
        role="radiogroup"
        aria-label={t('subjects.firstSource.title')}
        className="surface flex flex-col overflow-hidden rounded-card"
      >
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className="flex min-h-16 items-center gap-3 border-hairline py-2.5 pr-3 pl-3.5 text-left not-first:border-t aria-checked:bg-raised"
          >
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-[13px]',
                o.tile,
              )}
            >
              {o.icon}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <b className="text-[15px]">{t(`subjects.firstSource.${o.id}`)}</b>
              <span className="text-[13px] leading-[1.35] text-ink-secondary">
                {t(`subjects.firstSource.${o.id}Sub`)}
              </span>
            </span>
            {value === o.id ? (
              <CheckIcon size={20} className="shrink-0 text-brand" />
            ) : (
              <ChevronRightIcon size={20} className="shrink-0 text-ink-secondary" />
            )}
          </button>
        ))}
      </div>
      <span className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
        {t('subjects.firstSource.hint')}
      </span>
    </div>
  )
}
