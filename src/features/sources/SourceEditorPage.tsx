import type { TFunction } from 'i18next'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookIcon, ChevronLeftIcon, CloseIcon, SparkleIcon, WarningIcon } from '@/components/icons'
import { SplashScreen } from '@/components/SplashScreen'
import { Button } from '@/components/ui/button'
import { useAiAvailability } from '@/features/owl/api'
import { useSubject } from '@/features/subjects/api'
import { ChipGroup, fieldInput, fieldLabel } from '@/features/subjects/fields'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import {
  DEFAULT_ITEM_MINUTES,
  DEFAULT_MEASURE,
  estimateUnits,
  baseMinPerUnit,
} from '@/lib/estimates'
import { mergeOutline, type MergeStatus } from '@/lib/outline/merge'
import {
  formatOutline,
  parseOutline,
  type Measure,
  type OutlineUnit,
  type ParsedOutline,
} from '@/lib/outline/parse'
import { leavesOf } from '@/lib/progress'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useDeleteSource, useSaveOutline, useSource } from './api'
import { amountLabel, formatDuration } from './format'
import { carryDifficulty, sourceToForm, toFormattable, toStoredUnits } from './mappers'
import {
  activeUnits,
  OTHER_MEASURES,
  partialExams,
  SOURCE_KINDS,
  type SourceWithUnits,
} from './model'
import { ImportPhotos } from './ImportPhotos'
import { cycleDifficulty, nextLabel, removeUnit, upsertUnit } from './outlineEdit'
import {
  OUTLINE_MAX_LENGTH,
  outlineTextSchema,
  sourceFormSchema,
  type SourceForm,
  type UnitForm,
} from './schemas'
import { UnitSheet } from './UnitSheet'
import { useAiImport, type AiResult } from './useAiImport'

/**
 * DodajIzvor → Parsiranje for manual entry: /subjects/:id/sources/new, and "Uredi sadržaj" at
 * /subjects/:id/sources/:sourceId/edit (the same text, merged by label on save).
 */
export function SourceEditorPage() {
  const { id, sourceId } = useParams()
  const { data: subject, isPending } = useSubject(id)
  const { data: source, isPending: sourcePending } = useSource(id, sourceId)

  if (isPending || (sourceId && sourcePending)) return <SplashScreen />
  if (!subject) return <Navigate to="/subjects" replace />
  if (sourceId && !source) return <Navigate to={`/subjects/${subject.id}`} replace />
  return <SourceEditor key={sourceId ?? 'new'} subject={subject} source={source} />
}

type Step = { kind: 'input' } | ({ kind: 'review' } & AiResult)

const NO_AI = { topics: {}, warnings: [] }

function SourceEditor({
  subject,
  source,
}: {
  subject: SubjectWithAssessments
  source?: SourceWithUnits
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSaveOutline()
  const isEdit = Boolean(source)
  const existing = useMemo(() => (source ? activeUnits(source) : []), [source])

  const form = useForm<SourceForm>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: source
      ? sourceToForm(source)
      : {
          id: crypto.randomUUID(),
          subjectId: subject.id,
          kind: 'book',
          title: '',
          measure: 'pages',
          minutesPerItem: null,
        },
  })
  const [kind, measure] = useWatch({ control: form.control, name: ['kind', 'measure'] })
  const [text, setText] = useState(() =>
    source ? formatOutline(toFormattable(existing), measure) : '',
  )
  const [textError, setTextError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>({ kind: 'input' })
  const [mode, setMode] = useState<'photo' | 'text'>(isEdit ? 'text' : 'photo')
  const [files, setFiles] = useState<File[]>([])
  const ai = useAiImport(subject)
  const { state: aiState } = useAiAvailability()
  const aiReady = aiState === 'ready'

  const toReview = form.handleSubmit(() => {
    const checked = outlineTextSchema.safeParse(text)
    if (!checked.success) {
      setTextError(checked.error.issues[0]?.message ?? null)
      return
    }
    setTextError(null)
    const parsed = parseOutline(text, measure)
    setStep({
      kind: 'review',
      outline: { ...parsed, units: carryDifficulty(parsed.units, existing) },
      ...NO_AI,
    })
    window.scrollTo(0, 0)
  })

  /** "Izvuci poglavlja" (photos) or "Pretvori AI-jem" (pasted text). */
  const toAiReview = (input: 'files' | 'text') =>
    form.handleSubmit(async (values) => {
      if (input === 'text' && !text.trim()) return
      const result = await ai.run(
        values,
        measure,
        input === 'files' ? { kind: 'files', files } : { kind: 'text', text },
      )
      if (!result) return
      setStep({ kind: 'review', ...result })
      window.scrollTo(0, 0)
    })()

  // With partial exams the next step is ObimIspita, as in the mockup flow.
  const splitByExam = partialExams(subject.assessments).length > 0

  const onSave = (units: OutlineUnit[], topics: Record<string, string[]>) => {
    const values = form.getValues()
    const merge = mergeOutline(toStoredUnits(source?.units ?? []), units, () => crypto.randomUUID())
    save.mutate({ form: values, measure, merge, topics })
    // Questions go on to their chapter links (AI suggestions for review), then the exam scope.
    const linkable =
      measure === 'questions' && aiReady && merge.units.some((u) => u.status !== 'unchanged')
    navigate(
      linkable
        ? `/subjects/${subject.id}/sources/${values.id}/links`
        : splitByExam
          ? `/subjects/${subject.id}/scope?source=${values.id}`
          : `/subjects/${subject.id}/sources/${values.id}`,
      { replace: true },
    )
  }

  if (step.kind === 'review') {
    return (
      <Review
        outline={step.outline}
        topics={step.topics}
        aiWarnings={step.warnings}
        measure={measure}
        minutesRate={
          measure === 'items'
            ? (form.getValues('minutesPerItem') ?? DEFAULT_ITEM_MINUTES)
            : baseMinPerUnit(kind, measure)
        }
        existing={source}
        onChange={(outline) => setStep({ ...step, outline })}
        onTopics={(topics) => setStep({ ...step, topics })}
        rate={
          aiReady
            ? {
                busy: ai.busy,
                error: ai.error,
                run: async () => {
                  const result = await ai.run(form.getValues(), measure, {
                    kind: 'rate',
                    outline: step.outline,
                  })
                  if (result) setStep({ ...step, ...result, warnings: step.warnings })
                },
              }
            : null
        }
        onBack={() => {
          setText(formatOutline(step.outline.units, measure))
          setStep({ kind: 'input' })
        }}
        onSave={onSave}
        saveLabel={t(splitByExam ? 'sources.review.saveAndSplit' : 'common.save')}
      />
    )
  }

  const errors = form.formState.errors
  const set = { shouldDirty: true, shouldValidate: form.formState.isSubmitted } as const
  const pickKind = (k: SourceForm['kind']) => {
    form.setValue('kind', k, set)
    const m = DEFAULT_MEASURE[k]
    form.setValue('measure', m, set)
    form.setValue('minutesPerItem', null, set)
  }
  const pickMeasure = (m: (typeof OTHER_MEASURES)[number]) => {
    form.setValue('measure', m, set)
    form.setValue('minutesPerItem', m === 'items' ? DEFAULT_ITEM_MINUTES : null, set)
  }

  return (
    <form onSubmit={toReview} noValidate className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[13px] text-brand-muted">{subject.name}</span>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.4px]">
            {t(isEdit ? 'sources.editor.editTitle' : 'sources.editor.newTitle')}
          </h1>
        </div>
      </div>

      {!isEdit && (
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>{t('sources.editor.kind')}</span>
          <div role="radiogroup" className="grid grid-cols-3 gap-2">
            {SOURCE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => pickKind(k)}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-0.5 rounded-[18px] border-2 text-sm font-semibold',
                  kind === k ? 'border-brand-accent bg-canvas-soft' : 'border-surface glass',
                )}
              >
                {t(`sources.kind.${k}`)}
                <span className="text-[11px] font-normal text-ink-muted">
                  {t(`sources.kindUnit.${k}`)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {kind === 'other' && (
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>{t('sources.editor.measure')}</span>
          <ChipGroup
            options={OTHER_MEASURES.map((m) => ({
              value: m,
              label: t(`sources.editor.measureOption.${m}`),
            }))}
            value={measure as (typeof OTHER_MEASURES)[number]}
            onChange={pickMeasure}
          />
          {measure === 'items' && (
            <label className="flex flex-col gap-2">
              <span className="text-[13px] text-ink-muted">
                {t('sources.editor.minutesPerItem')}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                aria-invalid={Boolean(errors.minutesPerItem)}
                className={cn(fieldInput, 'glass')}
                {...form.register('minutesPerItem', {
                  setValueAs: (v: string) => (v === '' ? null : Number(v)),
                })}
              />
              <span className="text-xs leading-[1.4] text-ink-muted">
                {t('sources.editor.minutesPerItemHint')}
              </span>
            </label>
          )}
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('sources.editor.title')}</span>
        <input
          maxLength={120}
          placeholder={t('sources.editor.titlePlaceholder')}
          aria-invalid={Boolean(errors.title)}
          className={cn(fieldInput, 'h-[52px] glass')}
          {...form.register('title')}
        />
        {errors.title && (
          <span role="alert" className="text-sm text-danger">
            {t(validationKey(errors.title.message))}
          </span>
        )}
      </label>

      <OutlineInput
        measure={measure}
        mode={mode}
        onMode={setMode}
        text={text}
        error={textError}
        onText={(v) => {
          setText(v)
          if (textError) setTextError(null)
        }}
        files={files}
        onFiles={setFiles}
        busy={ai.busy}
        aiReady={aiReady}
        onAiText={() => void toAiReview('text')}
      />

      {ai.error && (
        <span role="alert" className="text-sm text-danger">
          {t(`owl.error.${ai.error as 'failed'}`)}
        </span>
      )}
      {mode === 'photo' ? (
        <>
          <span className="text-center text-xs text-ink-muted">
            {t('sources.import.deletedAfter')}
          </span>
          <Button
            type="button"
            size="pill"
            disabled={!aiReady || files.length === 0 || ai.busy}
            onClick={() => void toAiReview('files')}
            className="btn-primary"
          >
            {ai.busy
              ? t('sources.import.reading')
              : t(
                  measure === 'questions'
                    ? 'sources.import.extractQuestions'
                    : 'sources.import.extract',
                )}
          </Button>
        </>
      ) : (
        <Button type="submit" size="pill" className="mt-2 btn-primary">
          {t('sources.editor.review')}
        </Button>
      )}
      {source && <DeleteSource subjectId={subject.id} sourceId={source.id} />}
    </form>
  )
}

function OutlineInput({
  measure,
  mode,
  onMode,
  text,
  error,
  onText,
  files,
  onFiles,
  busy,
  aiReady,
  onAiText,
}: {
  measure: Measure
  mode: 'photo' | 'text'
  onMode: (mode: 'photo' | 'text') => void
  text: string
  error: string | null
  onText: (text: string) => void
  files: File[]
  onFiles: (files: File[]) => void
  busy: boolean
  aiReady: boolean
  onAiText: () => void
}) {
  const { t } = useTranslation()
  const { state } = useAiAvailability()
  return (
    <>
      <div role="tablist" className="flex rounded-[22px] bg-track p-1">
        {(['photo', 'text'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => onMode(m)}
            className={cn(
              'h-10 flex-1 rounded-[18px] text-sm font-semibold',
              mode === m && 'glass',
            )}
          >
            {t(`sources.editor.mode.${m}`)}
          </button>
        ))}
      </div>

      {mode === 'photo' ? (
        <>
          <ImportPhotos files={files} onChange={onFiles} disabled={busy} />
          {!aiReady && (
            <span className="text-[13px] text-ink-muted">
              {t(state === 'offline' ? 'owl.offline' : 'sources.import.noAi')}
            </span>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-2 rounded-card-lg glass p-4">
          <textarea
            rows={9}
            value={text}
            maxLength={OUTLINE_MAX_LENGTH}
            onChange={(e) => onText(e.target.value)}
            aria-label={t('sources.editor.outline')}
            aria-invalid={Boolean(error)}
            placeholder={t(`sources.editor.placeholder.${measure}`)}
            spellCheck={false}
            className="resize-none rounded-input border-2 border-transparent bg-canvas-soft p-3.5 text-[15px] leading-normal outline-none placeholder:text-ink-placeholder focus-visible:border-brand-accent aria-invalid:border-danger"
          />
          <span className="text-xs leading-[1.4] text-ink-muted">
            {t(`sources.editor.hint.${measure}`)}
          </span>
          {error && (
            <span role="alert" className="text-sm text-danger">
              {t(validationKey(error))}
            </span>
          )}
          {aiReady && (
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={onAiText}
              className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-brand disabled:opacity-50"
            >
              <SparkleIcon size={16} />
              {busy ? t('sources.import.reading') : t('sources.import.fromText')}
            </button>
          )}
        </div>
      )}
    </>
  )
}

function DeleteSource({ subjectId, sourceId }: { subjectId: string; sourceId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const remove = useDeleteSource(subjectId)
  const [confirm, setConfirm] = useState(false)
  return (
    <Button
      type="button"
      variant="link"
      className="h-11 text-danger"
      onClick={() => {
        if (!confirm) return setConfirm(true)
        remove.mutate(sourceId)
        navigate(`/subjects/${subjectId}`, { replace: true })
      }}
    >
      {t(confirm ? 'sources.editor.confirmDelete' : 'sources.editor.delete')}
    </Button>
  )
}

// ---------------------------------------------------------------- review (Parsiranje)

const STATUS_TAG: Partial<Record<MergeStatus, string>> = {
  new: 'bg-success-soft text-success',
  changed: 'bg-subject-blue-soft text-subject-blue-deep',
  restored: 'bg-brand-soft text-brand',
}

function Review({
  outline,
  topics,
  aiWarnings,
  measure,
  minutesRate,
  existing,
  onChange,
  onTopics,
  rate,
  onBack,
  onSave,
  saveLabel,
}: {
  outline: ParsedOutline
  topics: Record<string, string[]>
  aiWarnings: string[]
  measure: Measure
  minutesRate: number
  existing?: SourceWithUnits
  onChange: (outline: ParsedOutline) => void
  onTopics: (topics: Record<string, string[]>) => void
  /** "Procijeni težinu AI-jem"; null when AI is not available. */
  rate: { busy: boolean; error: string | null; run: () => Promise<void> } | null
  onBack: () => void
  onSave: (units: OutlineUnit[], topics: Record<string, string[]>) => void
  saveLabel: string
}) {
  const { t } = useTranslation()
  const units = outline.units
  const [sheet, setSheet] = useState<{ open: boolean; label: string | null }>({
    open: false,
    label: null,
  })

  // Preview of the merge only for the labels; ids are assigned again on save.
  const merge = useMemo(
    () => mergeOutline(toStoredUnits(existing?.units ?? []), units, () => ''),
    [existing, units],
  )
  const statusOf = new Map(merge.units.map((u) => [u.label, u.status]))

  const leaves = leavesOf(
    units.map((u) => ({ id: u.label, parentId: u.parentLabel, level: 0, minutes: 0 })),
  )
  const leafLabels = new Set(leaves.map((l) => l.id))
  const totalAmount = units.filter((u) => leafLabels.has(u.label)).reduce((s, u) => s + u.amount, 0)
  const estimates = estimateUnits(
    units
      .filter((u) => leafLabels.has(u.label))
      .map((u) => ({
        id: u.label,
        amount: u.amount,
        priorDifficulty: u.difficulty,
        userDifficulty: null,
      })),
    minutesRate,
  )
  const totalMinutes = [...estimates.values()].reduce((s, e) => s + e.minutes, 0)

  const editing = sheet.label ? units.find((u) => u.label === sheet.label) : undefined
  const sheetInitial: UnitForm = editing
    ? {
        label: editing.label,
        title: editing.title,
        pageStart: editing.pageStart,
        pageEnd: editing.pageEndDerived ? null : editing.pageEnd,
      }
    : { label: nextLabel(units, measure), title: '', pageStart: null, pageEnd: null }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('app.back')}
          className="flex size-11 items-center justify-center rounded-full glass"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <h1 className="text-base font-semibold">{t('sources.review.title')}</h1>
        <button
          type="button"
          onClick={() => setSheet({ open: true, label: null })}
          className="flex h-11 items-center rounded-full glass px-3.5 text-sm font-semibold text-brand"
        >
          {t('sources.review.add')}
        </button>
      </div>

      <div className="flex items-center gap-3.5 rounded-card glass p-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-brand-soft text-brand">
          <BookIcon />
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">
            {t('sources.review.summary', { count: units.length })}
            {measure !== 'questions' && measure !== 'items' && (
              <> · {amountLabel(t, measure, totalAmount)}</>
            )}
          </span>
          <span className="text-xs text-ink-muted">
            {t(
              Object.keys(topics).length > 0
                ? 'sources.review.estimateAi'
                : 'sources.review.estimate',
              {
                time: formatDuration(t, totalMinutes),
              },
            )}
          </span>
        </div>
      </div>

      {aiWarnings.map((w, i) => (
        <div
          key={`ai-${i}`}
          className="flex items-start gap-2.5 rounded-[20px] bg-warning-soft px-4 py-3.5"
        >
          <WarningIcon size={20} className="mt-px shrink-0 text-warning" />
          <span className="text-[13px] leading-[1.4] text-warning-ink">{w}</span>
        </div>
      ))}

      {rate && Object.keys(topics).length === 0 && units.length > 0 && (
        <button
          type="button"
          disabled={rate.busy}
          onClick={() => void rate.run()}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-full glass px-4 text-sm font-semibold text-brand disabled:opacity-50"
        >
          <SparkleIcon size={16} />
          {rate.busy ? t('sources.import.rating') : t('sources.import.rate')}
        </button>
      )}
      {rate?.error && (
        <span role="alert" className="text-sm text-danger">
          {t(`owl.error.${rate.error as 'failed'}`)}
        </span>
      )}

      {outline.warnings.map((w) => (
        <div
          key={w.code}
          className="flex items-start gap-2.5 rounded-[20px] bg-warning-soft px-4 py-3.5"
        >
          <WarningIcon size={20} className="mt-px shrink-0 text-warning" />
          <span className="text-[13px] leading-[1.4] text-warning-ink">
            {t(`sources.review.warning.${w.code}`, {
              labels: w.labels.join(', '),
              count: w.labels.length,
            })}
          </span>
        </div>
      ))}

      {units.length === 0 ? (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">{t('sources.review.empty')}</p>
      ) : (
        <div className="flex flex-col rounded-card glass p-1.5">
          {units.map((u) => {
            const status = existing ? statusOf.get(u.label) : undefined
            const guessed = u.amountGuessed && leafLabels.has(u.label)
            return (
              <div
                key={u.label}
                style={{ paddingLeft: 8 + u.depth * 20 }}
                className={cn(
                  'flex flex-wrap items-center gap-x-2 rounded-[16px] py-1.5 pr-1',
                  guessed && 'bg-warning-soft/60',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSheet({ open: true, label: u.label })}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span className="w-8 shrink-0 text-[13px] font-semibold text-ink-muted">
                    {u.label}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn('text-sm', u.depth === 0 ? 'font-semibold' : 'font-normal')}
                    >
                      {u.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle">
                      {unitMeta(t, measure, u)}

                      {status && STATUS_TAG[status] && (
                        <span
                          className={cn(
                            'rounded-[6px] px-1.5 py-px text-[10px] font-bold uppercase',
                            STATUS_TAG[status],
                          )}
                        >
                          {t(`sources.review.status.${status}`)}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                {leafLabels.has(u.label) && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...outline,
                        units: units.map((x) =>
                          x.label === u.label
                            ? { ...x, difficulty: cycleDifficulty(x.difficulty) }
                            : x,
                        ),
                      })
                    }
                    aria-label={t('sources.review.difficulty', { d: u.difficulty ?? 3 })}
                    className="flex h-11 shrink-0 items-center gap-0.5 px-1.5"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={cn(
                          'size-1.5 rounded-full',
                          n <= (u.difficulty ?? 3) ? 'bg-subject-pink' : 'bg-hairline',
                        )}
                      />
                    ))}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChange(removeUnit(units, u.label, measure))}
                  aria-label={t('sources.review.remove', { label: u.label })}
                  className="flex size-11 shrink-0 items-center justify-center text-ink-placeholder"
                >
                  <CloseIcon size={16} />
                </button>
                {(topics[u.label]?.length ?? 0) > 0 && (
                  <div className="flex basis-full flex-wrap gap-1.5 pb-1 pl-10">
                    {topics[u.label]!.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() =>
                          onTopics({
                            ...topics,
                            [u.label]: topics[u.label]!.filter((x) => x !== name),
                          })
                        }
                        aria-label={t('sources.import.removeTopic', { name })}
                        className="flex h-7 items-center gap-1 rounded-full bg-brand-soft px-2.5 text-[11px] font-semibold text-brand"
                      >
                        {name}
                        <CloseIcon size={10} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {merge.archive.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-card glass p-4">
          <span className="text-sm font-semibold">
            {t('sources.review.archiving', { count: merge.archive.length })}
          </span>
          <span className="text-xs leading-[1.4] text-ink-muted">
            {merge.archive.map((u) => `${u.label ?? ''} ${u.title}`.trim()).join(' · ')}
          </span>
          <span className="text-xs text-ink-muted">{t('sources.review.archivingHint')}</span>
        </div>
      )}

      <Button
        type="button"
        size="pill"
        disabled={units.length === 0}
        onClick={() => onSave(units, topics)}
        className="mt-2 btn-primary"
      >
        {saveLabel}
      </Button>

      <UnitSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        measure={measure}
        isNew={!editing}
        initial={sheetInitial}
        takenLabels={new Set(units.map((u) => u.label).filter((l) => l !== editing?.label))}
        onSubmit={(values) => onChange(upsertUnit(units, values, editing?.label ?? null, measure))}
      />
    </div>
  )
}

function unitMeta(t: TFunction, measure: Measure, u: OutlineUnit) {
  if (measure === 'questions' || measure === 'items') return null
  if (u.pageStart === null) {
    return u.amountGuessed ? t('sources.review.unknownAmount') : amountLabel(t, measure, u.amount)
  }
  const end = u.pageEnd === null ? '?' : String(u.pageEnd)
  const range = u.pageEnd === u.pageStart ? String(u.pageStart) : `${u.pageStart}–${end}`
  return t(measure === 'slides' ? 'sources.slidesRange' : 'sources.pagesRange', { range })
}
