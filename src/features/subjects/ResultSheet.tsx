import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/features/settings/useLocale'
import { suggestPassed } from '@/lib/grades'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useSaveDeadlineResult, useSaveExamResult } from './api'
import { NumberField, Segmented } from './fields'
import { formatPoints } from './grades'
import type { Assessment, Deadline } from './model'
import { resultFormSchema, type ResultForm } from './schemas'

export type ResultTarget = { kind: 'exam'; row: Assessment } | { kind: 'deadline'; row: Deadline }

interface ResultSheetProps {
  target?: ResultTarget
  subjectName: string
  /** Points the item carries in the subject; null = no points (only the result is kept). */
  worth: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** "Rezultat": points out of the test maximum or a percentage; passed; waive ("Poništi"). */
export function ResultSheet({ target, subjectName, worth, open, onOpenChange }: ResultSheetProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const at = target && (target.kind === 'exam' ? target.row.at : target.row.due_at)
  const subtitle = target
    ? [
        subjectName,
        target.row.title,
        format(new Date(at!), 'd. MMM', { locale: dateFnsLocales[locale] }),
      ].join(' · ')
    : undefined
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('grades.result.title')}
      subtitle={subtitle}
    >
      {open && target && (
        <ResultForm
          key={target.row.id}
          target={target}
          worth={worth}
          onDone={() => onOpenChange(false)}
        />
      )}
    </BottomSheet>
  )
}

function ResultForm({
  target,
  worth,
  onDone,
}: {
  target: ResultTarget
  worth: number | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const saveExam = useSaveExamResult()
  const saveDeadline = useSaveDeadlineResult()
  const row = target.row
  const exam = target.kind === 'exam' ? target.row : undefined
  const hasResult = row.result_points !== null && row.result_max !== null
  const defaultMax = worth ?? 100
  const [values, setValues] = useState<Partial<ResultForm>>(() => ({
    mode:
      hasResult && row.result_max === 100 && defaultMax !== 100 ? 'percent' : ('points' as const),
    points: row.result_points ?? undefined,
    max: row.result_max ?? defaultMax,
  }))
  const [passedTouched, setPassedTouched] = useState(false)
  const [passedManual, setPassedManual] = useState(exam?.passed ?? false)
  const [error, setError] = useState<string>()
  const mode = values.mode ?? 'points'
  const max = mode === 'percent' ? 100 : values.max
  const share =
    values.points !== undefined && max !== undefined && max > 0
      ? Math.min(1, Math.max(0, values.points / max))
      : null
  const suggested = share === null ? false : suggestPassed(share, row.pass_min_pct)
  const passed = exam ? (passedTouched ? passedManual : suggested) : suggested
  const pctLabel = share === null ? '' : formatPoints(share * 100, locale)

  const setMode = (m: ResultForm['mode']) => {
    // Keep the share when switching between points and percent.
    if (share === null) return setValues((v) => ({ ...v, mode: m }))
    setValues({
      mode: m,
      points: Math.round(share * (m === 'percent' ? 100 : defaultMax) * 100) / 100,
      max: m === 'percent' ? 100 : defaultMax,
    })
  }

  const save = () => {
    const parsed = resultFormSchema.safeParse({ ...values, mode, max, passed })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message)
    const result = { result_points: parsed.data.points, result_max: parsed.data.max }
    if (exam) {
      saveExam.mutate({
        id: exam.id,
        patch: { ...result, passed: parsed.data.passed, result_annulled: false },
      })
    } else {
      saveDeadline.mutate({ id: row.id, patch: { ...result, done: true } })
    }
    onDone()
  }

  const patchExam = (patch: Parameters<typeof saveExam.mutate>[0]['patch']) => {
    if (exam) saveExam.mutate({ id: exam.id, patch })
    onDone()
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Segmented
        label={t('grades.result.modeLabel')}
        className="self-start"
        options={[
          { value: 'points' as const, label: t('grades.result.modePoints') },
          { value: 'percent' as const, label: t('grades.result.modePercent') },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'points' ? (
        <div className="grid grid-cols-[1fr_24px_1fr] items-center gap-2">
          <NumberField
            key={`p-${mode}`}
            label={t('grades.result.points')}
            value={values.points ?? null}
            invalid={Boolean(error)}
            onChange={(n) => setValues((v) => ({ ...v, points: n ?? undefined }))}
            className="text-[22px] font-bold"
          />
          <span className="text-center text-ink-muted">{t('grades.result.of')}</span>
          <NumberField
            key={`m-${mode}`}
            label={t('grades.result.max')}
            value={values.max ?? null}
            onChange={(n) => setValues((v) => ({ ...v, max: n ?? undefined }))}
            className="text-[22px] text-ink-muted"
          />
        </div>
      ) : (
        <div className="relative">
          <NumberField
            key={`p-${mode}`}
            label={t('grades.result.percent')}
            value={values.points ?? null}
            invalid={Boolean(error)}
            onChange={(n) => setValues((v) => ({ ...v, points: n ?? undefined }))}
            className="w-full pr-10 text-[22px] font-bold"
          />
          <span className="absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted">%</span>
        </div>
      )}
      {error && (
        <span role="alert" className="text-sm text-danger">
          {t(validationKey(error))}
        </span>
      )}
      {mode === 'points' && worth !== null && (
        <span className="text-xs leading-[1.4] text-ink-muted">
          {t('grades.result.rescaleHint', { points: formatPoints(worth, locale) })}
        </span>
      )}

      {share !== null && (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-[18px] px-3.5 py-3',
            passed ? 'bg-success-soft' : 'bg-warning-soft',
          )}
        >
          <span
            className={cn(
              'text-[15px] font-semibold',
              passed ? 'text-subject-green-ink' : 'text-warning-ink',
            )}
          >
            {t(passed ? 'grades.result.passedLine' : 'grades.result.failedLine', {
              pct: pctLabel,
            })}
          </span>
          <span className={cn('text-xs', passed ? 'text-success' : 'text-warning')}>
            {row.pass_min_pct !== null
              ? t('grades.result.thresholdNote', {
                  pct: formatPoints(row.pass_min_pct, locale),
                })
              : worth !== null &&
                t('grades.result.contributes', {
                  points: formatPoints(worth * share, locale),
                  max: formatPoints(worth, locale),
                })}
          </span>
        </div>
      )}
      {exam && share !== null && (
        <Switch
          checked={passed}
          label={t('grades.result.passed')}
          onChange={(v) => {
            setPassedTouched(true)
            setPassedManual(v)
          }}
        />
      )}

      <Button type="button" size="pill" onClick={save} className="btn-primary">
        {t('grades.result.save')}
      </Button>

      {exam && hasResult && !exam.result_annulled && (
        <div className="flex flex-col items-center gap-1">
          <Button
            type="button"
            variant="link"
            className="h-11 text-danger"
            onClick={() => patchExam({ result_annulled: true, passed: false })}
          >
            {t('grades.result.annul')}
          </Button>
          <span className="text-center text-xs leading-[1.4] text-ink-muted">
            {t('grades.result.annulHint')}
          </span>
        </div>
      )}
      {exam?.result_annulled && hasResult && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-center text-xs text-ink-muted">{t('grades.result.annulled')}</span>
          <Button
            type="button"
            variant="link"
            className="h-11 text-brand"
            onClick={() =>
              patchExam({
                result_annulled: false,
                passed: suggestPassed(row.result_points! / row.result_max!, row.pass_min_pct),
              })
            }
          >
            {t('grades.result.restore')}
          </Button>
        </div>
      )}
      {hasResult && (
        <Button
          type="button"
          variant="link"
          className="h-11 text-ink-muted"
          onClick={() => {
            if (exam) {
              patchExam({
                result_points: null,
                result_max: null,
                result_annulled: false,
                passed: false,
              })
            } else {
              saveDeadline.mutate({ id: row.id, patch: { result_points: null, result_max: null } })
              onDone()
            }
          }}
        >
          {t('grades.result.clear')}
        </Button>
      )}
    </div>
  )
}
