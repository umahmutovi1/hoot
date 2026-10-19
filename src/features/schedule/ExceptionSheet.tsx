import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Button } from '@/components/ui/button'
import { ChipGroup, fieldInput, fieldLabel } from '@/features/subjects/fields'
import { formatClock, parseClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useDeleteException, useSaveException } from './api'
import { exceptionType, type ExceptionRow } from './model'
import { EXCEPTION_TYPES, exceptionFormSchema, type ExceptionForm } from './schemas'

interface ExceptionSheetProps {
  exception?: ExceptionRow
  /** Date for a new exception. */
  date: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Izuzetak: busy all day, busy from–to, or extra free time on one date. */
export function ExceptionSheet({ exception, date, open, onOpenChange }: ExceptionSheetProps) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(exception ? 'availability.editException' : 'availability.newException')}
    >
      {open && (
        <ExceptionFormView exception={exception} date={date} onDone={() => onOpenChange(false)} />
      )}
    </BottomSheet>
  )
}

function ExceptionFormView({
  exception,
  date,
  onDone,
}: {
  exception?: ExceptionRow
  date: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveException()
  const remove = useDeleteException()
  const form = useForm<ExceptionForm>({
    resolver: zodResolver(exceptionFormSchema),
    defaultValues: exception
      ? {
          id: exception.id,
          type: exceptionType(exception),
          onDate: exception.on_date,
          start: exception.start_min === null ? '' : formatClock(exception.start_min),
          end: exception.end_min === null ? '' : formatClock(exception.end_min),
        }
      : { id: crypto.randomUUID(), type: 'busyDay', onDate: date, start: '', end: '' },
  })
  const type = useWatch({ control: form.control, name: 'type' })
  const errors = form.formState.errors
  const set = { shouldDirty: true, shouldValidate: form.formState.isSubmitted } as const

  const submit = form.handleSubmit((v) => {
    const allDay = v.type === 'busyDay'
    save.mutate({
      id: v.id,
      on_date: v.onDate,
      is_busy: v.type !== 'extraFree',
      start_min: allDay ? null : parseClock(v.start),
      end_min: allDay ? null : parseClock(v.end),
    })
    onDone()
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('availability.exceptionType')}</span>
        <ChipGroup
          options={EXCEPTION_TYPES.map((k) => ({ value: k, label: t(`availability.type.${k}`) }))}
          value={type}
          onChange={(k) => form.setValue('type', k, set)}
        />
      </div>

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('availability.date')}</span>
        <input
          type="date"
          aria-invalid={Boolean(errors.onDate)}
          className={fieldInput}
          {...form.register('onDate')}
        />
      </label>

      {type !== 'busyDay' && (
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
      )}
      {(errors.onDate || errors.start || errors.end) && (
        <span role="alert" className="-mt-2 text-sm text-danger">
          {t(validationKey(errors.onDate?.message ?? errors.start?.message ?? errors.end?.message))}
        </span>
      )}

      <Button type="submit" size="pill" className="bg-brand text-white hover:bg-brand-strong">
        {t('common.save')}
      </Button>
      {exception && (
        <Button
          type="button"
          variant="link"
          className="h-11 text-danger"
          onClick={() => {
            remove.mutate(exception.id)
            onDone()
          }}
        >
          {t('availability.deleteException')}
        </Button>
      )}
    </form>
  )
}
