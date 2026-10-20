import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { CloseIcon, PlusIcon, WarningIcon } from '@/components/icons'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { useSubjects } from '@/features/subjects/api'
import { ChipGroup, fieldLabel } from '@/features/subjects/fields'
import { useLocale } from '@/features/settings/useLocale'
import { toDisplayDate, weekdayOf, type LocalDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import {
  capFor,
  classesOverlapping,
  DEFAULT_SLOT,
  formatClock,
  parseClock,
  parseEndClock,
  slotsFor,
} from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { validationKey } from '@/lib/validation'
import { useDeleteDay, useSaveDay, useSaveWeekdayTemplate } from './api'
import { clockRange } from './format'
import { toStoredSlots } from './model'
import { dayFormSchema, type DayForm } from './schemas'
import { useScheduleData } from './useScheduleData'
import { useWeekdayNames } from './weekdays'

interface DaySheetProps {
  /** The day being edited; the form saves it as "Samo ovaj dan" or "Svaki <dan>". */
  date: LocalDate
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Edit when you can study on a day (slots) and how much at most (cap). */
export function DaySheet({ date, open, onOpenChange }: DaySheetProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const title = format(toDisplayDate(date), 'EEEE, d. MMMM', { locale: dateFnsLocales[locale] })
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title.charAt(0).toUpperCase() + title.slice(1)}
      subtitle={t('availability.sheetSubtitle')}
    >
      {open && <DayFormView date={date} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function DayFormView({ date, onDone }: { date: LocalDate; onDone: () => void }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const long = useWeekdayNames('long')
  const data = useScheduleData()
  const { data: subjects = [] } = useSubjects()
  const saveDay = useSaveDay()
  const deleteDay = useDeleteDay()
  const saveTemplate = useSaveWeekdayTemplate()
  const weekday = weekdayOf(date)
  const day = data.dayRows.find((d) => d.on_date === date)
  const input = { rules: data.rules, days: data.days, caps: data.caps }
  const initialSlots = slotsFor(date, input)
  const initialCap = capFor(date, input)

  const form = useForm<DayForm>({
    resolver: zodResolver(dayFormSchema),
    defaultValues: {
      slots: [...initialSlots]
        .sort((a, b) => a.startMin - b.startMin)
        .map((s) => ({
          start: formatClock(s.startMin),
          end: formatClock(s.endMin),
          overClasses: Boolean(s.overClasses),
        })),
      capHours: initialCap / 60,
      scope: 'day',
    },
  })
  const slots = useFieldArray({ control: form.control, name: 'slots' })
  const [values, capHours, scope] = useWatch({
    control: form.control,
    name: ['slots', 'capHours', 'scope'],
  })
  const errors = form.formState.errors.slots

  const submit = form.handleSubmit((v) => {
    const parsed = v.slots.map((s) => ({
      startMin: parseClock(s.start)!,
      endMin: parseEndClock(s.end)!,
      overClasses: s.overClasses,
    }))
    const capMin = Math.round(v.capHours * 60)
    if (v.scope === 'day') {
      saveDay.mutate({
        id: day?.id ?? crypto.randomUUID(),
        on_date: date,
        slots: toStoredSlots(parsed) as never,
        cap_min: capMin,
      })
    } else {
      const caps = [...data.caps]
      caps[weekday] = capMin
      saveTemplate.mutate({
        weekday,
        slots: parsed.map((s) => ({
          start_min: s.startMin,
          end_min: s.endMin,
          over_classes: s.overClasses,
        })),
        caps,
        clearDayId: day?.id,
      })
    }
    onDone()
  })

  const stepCap = (delta: number) =>
    form.setValue('capHours', Math.min(24, Math.max(0, capHours + delta)), { shouldDirty: true })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('availability.slots')}</span>
        {slots.fields.map((field, i) => {
          const start = parseClock(values[i]?.start ?? '')
          const end = parseEndClock(values[i]?.end ?? '')
          const overlaps =
            start !== null && end !== null && end > start
              ? classesOverlapping({ startMin: start, endMin: end }, data.classes, data.periods, {
                  date,
                })
              : []
          const error = errors?.[i]?.end?.message ?? errors?.[i]?.start?.message
          return (
            <div key={field.id} className="flex flex-col gap-2 rounded-[18px] bg-canvas p-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  step={300}
                  aria-label={t('timetable.start')}
                  className="h-11 min-w-0 flex-1 rounded-xl bg-surface px-3 text-base"
                  {...form.register(`slots.${i}.start`)}
                />
                <span className="text-ink-muted">–</span>
                <input
                  type="time"
                  step={300}
                  aria-label={t('timetable.end')}
                  className="h-11 min-w-0 flex-1 rounded-xl bg-surface px-3 text-base"
                  {...form.register(`slots.${i}.end`)}
                />
                <button
                  type="button"
                  onClick={() => slots.remove(i)}
                  aria-label={t('availability.deleteSlot')}
                  className="flex size-11 shrink-0 items-center justify-center text-ink-muted"
                >
                  <CloseIcon size={16} />
                </button>
              </div>
              {error && (
                <span role="alert" className="px-1 text-xs text-danger">
                  {t(validationKey(error))}
                </span>
              )}
              {overlaps.length > 0 && (
                <div className="flex flex-col gap-1 rounded-[14px] bg-warning-soft px-3 py-2.5">
                  <span className="flex items-start gap-2 text-[13px] leading-[1.4] text-warning-ink">
                    <WarningIcon size={16} className="mt-px shrink-0 text-warning" />
                    {t('availability.overlap', {
                      classes: overlaps
                        .map(
                          (c) =>
                            `${subjects.find((s) => s.id === c.subjectId)?.name ?? ''} · ${t(`timetable.kind.${c.kind}`).toLowerCase()} ${clockRange(c.startMin, c.endMin)}`,
                        )
                        .join(', '),
                    })}
                  </span>
                  <Switch
                    checked={values[i]?.overClasses ?? false}
                    label={t('availability.overClasses')}
                    onChange={(v) =>
                      form.setValue(`slots.${i}.overClasses`, v, { shouldDirty: true })
                    }
                  />
                </div>
              )}
            </div>
          )
        })}
        {slots.fields.length === 0 && (
          <p className="rounded-[18px] bg-canvas px-4 py-3 text-sm text-ink-muted">
            {t('availability.noSlots')}
          </p>
        )}
        <button
          type="button"
          onClick={() =>
            slots.append({
              start: formatClock(DEFAULT_SLOT.startMin),
              end: formatClock(DEFAULT_SLOT.endMin),
              overClasses: false,
            })
          }
          className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-dashed border-line text-sm font-semibold text-brand"
        >
          <PlusIcon size={16} />
          {t('availability.addSlot')}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className={fieldLabel}>{t('availability.cap')}</span>
          <span className="text-xs text-ink-muted">{t('availability.capHint')}</span>
        </span>
        <div className="flex items-center gap-1 rounded-full bg-canvas p-1">
          <button
            type="button"
            aria-label={t('availability.capLess')}
            onClick={() => stepCap(-0.5)}
            className="flex size-10 items-center justify-center rounded-full bg-surface text-lg font-semibold"
          >
            −
          </button>
          <span className="w-14 text-center text-[15px] font-bold">
            {t('availability.hours', { h: capHours.toLocaleString(locale) })}
          </span>
          <button
            type="button"
            aria-label={t('availability.capMore')}
            onClick={() => stepCap(0.5)}
            className="flex size-10 items-center justify-center rounded-full bg-surface text-lg font-semibold"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>{t('availability.applyTo')}</span>
        <ChipGroup
          options={[
            {
              value: 'day' as const,
              label: t('availability.onlyDay', {
                date: format(toDisplayDate(date), 'd. MMM', { locale: dateFnsLocales[locale] }),
              }),
            },
            {
              value: 'weekday' as const,
              label: t('availability.everyWeekday', { day: long[weekday] }),
            },
          ]}
          value={scope}
          onChange={(s) => form.setValue('scope', s, { shouldDirty: true })}
        />
      </div>

      <Button type="submit" size="pill" className="bg-brand text-white hover:bg-brand-strong">
        {t('common.save')}
      </Button>
      {day && (
        <Button
          type="button"
          variant="link"
          className={cn('h-11 text-brand')}
          onClick={() => {
            deleteDay.mutate(day.id)
            onDone()
          }}
        >
          {t('availability.resetDay', { day: long[weekday] })}
        </Button>
      )}
    </form>
  )
}
