import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Button } from '@/components/ui/button'
import { fieldInput, fieldLabel } from '@/features/subjects/fields'
import { formatClock, parseClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useDeleteRule, useSaveRule } from './api'
import type { RuleRow } from './model'
import { slotFormSchema, type SlotForm } from './schemas'
import { useWeekdayNames } from './weekdays'

interface SlotSheetProps {
  rule?: RuleRow
  weekday: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** One weekly free slot (Dostupnost): from–to on a weekday. */
export function SlotSheet({ rule, weekday, open, onOpenChange }: SlotSheetProps) {
  const { t } = useTranslation()
  const names = useWeekdayNames('long')
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(rule ? 'availability.editSlot' : 'availability.newSlot')}
      subtitle={names[rule?.weekday ?? weekday]}
    >
      {open && <SlotFormView rule={rule} weekday={weekday} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function SlotFormView({
  rule,
  weekday,
  onDone,
}: {
  rule?: RuleRow
  weekday: number
  onDone: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveRule()
  const remove = useDeleteRule()
  const form = useForm<SlotForm>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: rule
      ? {
          id: rule.id,
          weekday: rule.weekday,
          start: formatClock(rule.start_min),
          end: formatClock(rule.end_min),
        }
      : { id: crypto.randomUUID(), weekday, start: '', end: '' },
  })
  const errors = form.formState.errors

  const submit = form.handleSubmit((v) => {
    save.mutate({
      id: v.id,
      weekday: v.weekday,
      start_min: parseClock(v.start)!,
      end_min: parseClock(v.end)!,
    })
    onDone()
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
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
      <span className="text-xs leading-[1.4] text-ink-muted">{t('availability.slotHint')}</span>
      <Button type="submit" size="pill" className="bg-brand text-white hover:bg-brand-strong">
        {t('common.save')}
      </Button>
      {rule && (
        <Button
          type="button"
          variant="link"
          className="h-11 text-danger"
          onClick={() => {
            remove.mutate(rule.id)
            onDone()
          }}
        >
          {t('availability.deleteSlot')}
        </Button>
      )}
    </form>
  )
}
