import { useTranslation } from 'react-i18next'
import { addDays, addWeeks, format, isSameDay, startOfWeek } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { useWeekdayNames } from '@/features/schedule/weekdays'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { DayDots } from './DayDots'

/** The week around `selected` as day pills (Satnica mockup / day-view inspiration). */
export function DayStrip({
  selected,
  today,
  onSelect,
}: {
  selected: Date
  today: Date
  onSelect: (date: Date) => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const dfLocale = dateFnsLocales[locale]
  const monday = startOfWeek(selected, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const names = useWeekdayNames('short')

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="pl-1 text-lg font-semibold first-letter:uppercase" aria-live="polite">
          {format(selected, 'LLLL yyyy', { locale: dfLocale })}
        </h2>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label={t('plan.prevWeek')}
            onClick={() => onSelect(addWeeks(selected, -1))}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-surface"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            type="button"
            aria-label={t('plan.nextWeek')}
            onClick={() => onSelect(addWeeks(selected, 1))}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-surface"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>
      <div className="flex gap-1.5">
        {days.map((d, i) => {
          const on = isSameDay(d, selected)
          const isToday = isSameDay(d, today)
          return (
            <button
              key={d.toISOString()}
              type="button"
              aria-pressed={on}
              aria-label={format(d, 'EEEE, d. MMMM', { locale: dfLocale })}
              onClick={() => onSelect(d)}
              className={cn(
                'flex h-[68px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px]',
                on ? 'bg-ink text-white' : isToday ? 'bg-brand-soft' : 'bg-surface',
              )}
            >
              <span className="text-lg font-bold">{format(d, 'd')}</span>
              <span className={cn('text-[11px]', !on && 'text-ink-muted')}>{names[i]}</span>
              <DayDots date={d} max={2} light={on} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
