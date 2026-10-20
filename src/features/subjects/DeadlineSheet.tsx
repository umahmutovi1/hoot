import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { useGlobalScale } from '@/features/settings/profile'
import { validationKey } from '@/lib/validation'
import { useDeleteDeadline, useSaveDeadline, useSetDeadlineDone, useSubjects } from './api'
import { paletteOf } from './colors'
import { ChipGroup, fieldInput, fieldLabel } from './fields'
import { gradeSubjectOf } from './grades'
import { deadlineToForm } from './mappers'
import { DEADLINE_KINDS, type Deadline } from './model'
import { PointsFields } from './PointsFields'
import { deadlineFormSchema, GRADE_FIELD_DEFAULTS, type DeadlineForm } from './schemas'

const NO_SUBJECT = 'none'
const HOURS_STEP = 0.5

interface DeadlineSheetProps {
  /** Deadline to edit; undefined = new deadline. */
  deadline?: Deadline
  /** Preselected subject for a new deadline. */
  subjectId?: string | null
  /** Preselected due date (`yyyy-MM-dd`) for a new deadline. */
  date?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeadlineSheet({
  deadline,
  subjectId,
  date,
  open,
  onOpenChange,
}: DeadlineSheetProps) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(deadline ? 'deadlines.editTitle' : 'deadlines.newTitle')}
    >
      {open && (
        <DeadlineFormBody
          deadline={deadline}
          subjectId={subjectId ?? null}
          date={date ?? ''}
          onDone={() => onOpenChange(false)}
        />
      )}
    </BottomSheet>
  )
}

function DeadlineFormBody({
  deadline,
  subjectId,
  date,
  onDone,
}: {
  deadline?: Deadline
  subjectId: string | null
  date: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const globalScale = useGlobalScale()
  const { data: subjects = [] } = useSubjects()
  const save = useSaveDeadline()
  const remove = useDeleteDeadline()
  const setDone = useSetDeadlineDone()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const form = useForm<DeadlineForm>({
    resolver: zodResolver(deadlineFormSchema),
    defaultValues: deadline
      ? deadlineToForm(deadline)
      : {
          id: crypto.randomUUID(),
          subjectId,
          title: '',
          kind: 'assignment',
          date,
          estHours: null,
          notes: null,
          ...GRADE_FIELD_DEFAULTS,
        },
  })
  const [kind, selectedSubject, estHours, pointsMax, pointsUnit, passMinPct] = useWatch({
    control: form.control,
    name: ['kind', 'subjectId', 'estHours', 'pointsMax', 'pointsUnit', 'passMinPct'],
  })
  const subject = subjects.find((s) => s.id === selectedSubject)
  const errors = form.formState.errors
  const set = { shouldDirty: true, shouldValidate: form.formState.isSubmitted } as const
  const activeSubjects = subjects.filter((s) => !s.archived || s.id === selectedSubject)

  const submit = form.handleSubmit((values) => {
    save.mutate(values)
    onDone()
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('deadlines.title')}</span>
        <input
          maxLength={80}
          placeholder={t('deadlines.titlePlaceholder')}
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
        <span className={fieldLabel}>{t('deadlines.subject')}</span>
        <ChipGroup
          options={[
            { value: NO_SUBJECT, label: t('deadlines.noSubject') },
            ...activeSubjects.map((s) => ({
              value: s.id,
              label: s.name,
              dot: paletteOf(s.color).bar,
            })),
          ]}
          value={selectedSubject ?? NO_SUBJECT}
          onChange={(v) => form.setValue('subjectId', v === NO_SUBJECT ? null : v, set)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('deadlines.kindLabel')}</span>
        <ChipGroup
          options={DEADLINE_KINDS.map((k) => ({ value: k, label: t(`deadlines.kind.${k}`) }))}
          value={kind}
          onChange={(k) => form.setValue('kind', k, set)}
        />
      </div>

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('deadlines.date')}</span>
        <input
          type="date"
          aria-invalid={Boolean(errors.date)}
          className={fieldInput}
          {...form.register('date')}
        />
        {errors.date && (
          <span role="alert" className="text-sm text-danger">
            {t(validationKey(errors.date.message))}
          </span>
        )}
      </label>

      <div className="flex flex-col gap-1">
        <Switch
          checked={estHours !== null}
          label={t('deadlines.inPlan')}
          onChange={(on) => form.setValue('estHours', on ? 2 : null, set)}
        />
        {estHours !== null && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex flex-col gap-0.5">
              <span className={fieldLabel}>{t('deadlines.estimate')}</span>
              <span className="text-xs text-ink-muted">{t('deadlines.estimateHint')}</span>
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t('deadlines.less')}
                onClick={() =>
                  form.setValue('estHours', Math.max(HOURS_STEP, estHours - HOURS_STEP), set)
                }
                className="size-11 rounded-full border border-line text-xl text-brand"
              >
                −
              </button>
              <span className="min-w-16 text-center text-[17px] font-bold">
                {t('deadlines.hours', { hours: estHours })}
              </span>
              <button
                type="button"
                aria-label={t('deadlines.more')}
                onClick={() => form.setValue('estHours', Math.min(200, estHours + HOURS_STEP), set)}
                className="size-11 rounded-full border border-line text-xl text-brand"
              >
                +
              </button>
            </span>
          </div>
        )}
      </div>

      {subject && (
        <PointsFields
          value={{ pointsMax, pointsUnit, passMinPct }}
          onChange={(patch) => {
            if (patch.pointsMax !== undefined) form.setValue('pointsMax', patch.pointsMax, set)
            if (patch.pointsUnit) form.setValue('pointsUnit', patch.pointsUnit, set)
            if (patch.passMinPct !== undefined) form.setValue('passMinPct', patch.passMinPct, set)
          }}
          pointsTotal={gradeSubjectOf(subject, globalScale).pointsTotal}
          thresholdHint={t('grades.fields.thresholdHintDeadline')}
          errors={{
            pointsMax: errors.pointsMax && validationKey(errors.pointsMax.message),
            passMinPct: errors.passMinPct && validationKey(errors.passMinPct.message),
          }}
        />
      )}

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>
          {t('deadlines.notes')}{' '}
          <span className="font-normal text-ink-muted">{t('deadlines.optional')}</span>
        </span>
        <textarea
          rows={2}
          maxLength={500}
          className="rounded-input border-2 border-transparent bg-canvas px-4 py-3 text-base outline-none focus-visible:border-brand-accent"
          {...form.register('notes')}
        />
      </label>

      {deadline && (
        <Switch
          checked={deadline.done}
          label={t('deadlines.done')}
          onChange={(done) => setDone.mutate({ id: deadline.id, done })}
        />
      )}

      <Button type="submit" size="pill" className="bg-brand text-white hover:bg-brand-strong">
        {t('common.save')}
      </Button>
      {deadline && (
        <Button
          type="button"
          variant="link"
          className="h-11 text-danger"
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            remove.mutate(deadline.id)
            onDone()
          }}
        >
          {t(confirmDelete ? 'deadlines.confirmDelete' : 'deadlines.delete')}
        </Button>
      )}
    </form>
  )
}
