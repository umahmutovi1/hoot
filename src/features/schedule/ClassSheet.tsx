import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { PlusIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { ChipGroup, fieldInput, fieldLabel } from '@/features/subjects/fields'
import { QuickSubject } from '@/features/subjects/QuickSubject'
import { formatClock, parseClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useDeleteClass, useSaveClass } from './api'
import { CLASS_KINDS, type PeriodRow, type TimetableRow } from './model'
import { classFormSchema, type ClassForm } from './schemas'
import { useWeekdayNames } from './weekdays'

interface ClassSheetProps {
  entry?: TimetableRow
  /** Teaching periods to choose from; the first is the default for a new entry. */
  periods: PeriodRow[]
  weekday: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClassSheet({ entry, periods, weekday, open, onOpenChange }: ClassSheetProps) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(entry ? 'timetable.editTitle' : 'timetable.newTitle')}
    >
      {open && (
        <ClassFormView
          entry={entry}
          periods={periods}
          weekday={weekday}
          onDone={() => onOpenChange(false)}
        />
      )}
    </BottomSheet>
  )
}

function ClassFormView({
  entry,
  periods,
  weekday,
  onDone,
}: {
  entry?: TimetableRow
  periods: PeriodRow[]
  weekday: number
  onDone: () => void
}) {
  const { t } = useTranslation()
  const days = useWeekdayNames('short')
  const { data: subjects = [] } = useSubjects()
  const active = subjects.filter((s) => !s.archived)
  const save = useSaveClass()
  const remove = useDeleteClass()
  const [confirmDelete, setConfirmDelete] = useState(false)
  // With no subjects yet, the new class starts with creating one.
  const [newSubject, setNewSubject] = useState(!entry && active.length === 0)
  const form = useForm<ClassForm>({
    resolver: zodResolver(classFormSchema),
    defaultValues: entry
      ? {
          id: entry.id,
          subjectId: entry.subject_id ?? '',
          kind: entry.kind,
          weekday: entry.weekday,
          start: formatClock(entry.start_min),
          end: formatClock(entry.end_min),
          location: entry.location ?? '',
          weekParity: (entry.week_parity as 'odd' | 'even' | null) ?? 'all',
          periodId: entry.period_id ?? periods[0]?.id ?? '',
        }
      : {
          id: crypto.randomUUID(),
          subjectId: active.length === 1 ? active[0]!.id : '',
          kind: 'lecture',
          weekday,
          start: '',
          end: '',
          location: '',
          weekParity: 'all',
          periodId: periods[0]?.id ?? '',
        },
  })
  const [subjectId, kind, day, parity, periodId] = useWatch({
    control: form.control,
    name: ['subjectId', 'kind', 'weekday', 'weekParity', 'periodId'],
  })
  const errors = form.formState.errors
  const set = { shouldDirty: true, shouldValidate: form.formState.isSubmitted } as const

  const submit = form.handleSubmit((v) => {
    const period = periods.find((p) => p.id === v.periodId)!
    save.mutate({
      id: v.id,
      subject_id: v.subjectId,
      kind: v.kind,
      weekday: v.weekday,
      start_min: parseClock(v.start)!,
      end_min: parseClock(v.end)!,
      location: v.location || null,
      week_parity: v.weekParity === 'all' ? null : v.weekParity,
      period_id: period.id,
      valid_from: period.starts_on,
      valid_to: period.ends_on,
    })
    onDone()
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('timetable.subject')}</span>
        <ChipGroup
          options={active.map((s) => ({
            value: s.id,
            label: s.name,
            dot: paletteOf(s.color).bar,
          }))}
          value={subjectId || null}
          onChange={(id) => form.setValue('subjectId', id, set)}
        />
        {newSubject ? (
          <QuickSubject
            autoFocus={active.length > 0}
            onCreated={(id) => {
              form.setValue('subjectId', id, set)
              setNewSubject(false)
            }}
            onCancel={() => setNewSubject(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setNewSubject(true)}
            className="flex h-11 items-center gap-1.5 self-start rounded-full px-1 text-[13px] font-semibold text-brand"
          >
            <PlusIcon className="size-4" />
            {t('subjects.quick.open')}
          </button>
        )}
        {errors.subjectId && (
          <span role="alert" className="text-sm text-danger">
            {t('timetable.pickSubject')}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('timetable.kindLabel')}</span>
        <ChipGroup
          options={CLASS_KINDS.map((k) => ({ value: k, label: t(`timetable.kind.${k}`) }))}
          value={kind}
          onChange={(k) => form.setValue('kind', k, set)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('timetable.day')}</span>
        <div role="radiogroup" className="grid grid-cols-7 gap-1">
          {days.map((name, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={day === i}
              onClick={() => form.setValue('weekday', i, set)}
              className={cn(
                'h-11 rounded-full text-[13px] font-semibold',
                day === i ? 'bg-brand text-white' : 'bg-canvas',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['start', 'end'] as const).map((key) => (
          <label key={key} className="flex min-w-0 flex-col gap-2">
            <span className={fieldLabel}>{t(`timetable.${key}`)}</span>
            <input
              type="time"
              step={300}
              aria-invalid={Boolean(errors[key])}
              className={cn(fieldInput, 'px-3')}
              {...form.register(key)}
            />
          </label>
        ))}
      </div>
      {(errors.start || errors.end) && (
        <span role="alert" className="-mt-2 text-sm text-danger">
          {t(validationKey(errors.start?.message ?? errors.end?.message))}
        </span>
      )}

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>
          {t('timetable.location')}{' '}
          <span className="font-normal text-ink-muted">{t('timetable.optional')}</span>
        </span>
        <input
          maxLength={40}
          placeholder={t('timetable.locationPlaceholder')}
          className={fieldInput}
          {...form.register('location')}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('timetable.weeks')}</span>
        <ChipGroup
          options={(['all', 'odd', 'even'] as const).map((p) => ({
            value: p,
            label: t(`timetable.parity.${p}`),
          }))}
          value={parity}
          onChange={(p) => form.setValue('weekParity', p, set)}
        />
      </div>

      {periods.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>{t('timetable.period')}</span>
          <ChipGroup
            options={periods.map((p) => ({ value: p.id, label: p.title }))}
            value={periodId}
            onChange={(id) => form.setValue('periodId', id, set)}
          />
        </div>
      )}

      <Button type="submit" size="pill" className="bg-brand text-white hover:bg-brand-strong">
        {t('common.save')}
      </Button>
      {entry && (
        <Button
          type="button"
          variant="link"
          className="h-11 text-danger"
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            remove.mutate(entry.id)
            onDone()
          }}
        >
          {t(confirmDelete ? 'timetable.confirmDelete' : 'timetable.delete')}
        </Button>
      )}
    </form>
  )
}
