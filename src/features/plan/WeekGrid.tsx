import { useTranslation } from 'react-i18next'
import { addDays, format, isSameDay, startOfWeek } from 'date-fns'
import { useWeekdayNames } from '@/features/schedule/weekdays'
import { paletteOf } from '@/features/subjects/colors'
import { localDateOf } from '@/features/subjects/model'
import { formatClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import type { DayClass } from './agenda'
import { hourRange, layoutLanes } from './calendar'
import { DayDots } from './DayDots'

const HOUR_PX = 40
const AXIS_PX = 34

/** Week view: seven narrow columns on one time axis; tapping a day opens the day view. */
export function WeekGrid({
  selected,
  today,
  classesFor,
  onPickDay,
  onPickClass,
}: {
  selected: Date
  today: Date
  classesFor: (date: string) => DayClass[]
  onPickDay: (date: Date) => void
  onPickClass: (item: DayClass, date: Date) => void
}) {
  const { t } = useTranslation()
  const names = useWeekdayNames('short')
  const monday = startOfWeek(selected, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const perDay = days.map((d) => classesFor(localDateOf(d.toISOString())))
  const [from, to] = hourRange(perDay.flat())
  const top = (min: number) => ((min - from * 60) / 60) * HOUR_PX
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i)

  return (
    <div className="flex flex-col gap-2 rounded-card-lg bg-surface p-3">
      <div className="flex" style={{ paddingLeft: AXIS_PX }}>
        {days.map((d, i) => {
          const on = isSameDay(d, selected)
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onPickDay(d)}
              aria-label={t('plan.openDay', { day: format(d, 'd. M.') })}
              className="flex min-h-11 flex-1 flex-col items-center justify-center"
            >
              <span className="text-[10px] font-semibold text-ink-muted">{names[i]}</span>
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-sm font-bold',
                  on ? 'bg-ink text-white' : isSameDay(d, today) && 'bg-brand-soft',
                )}
              >
                {format(d, 'd')}
              </span>
              <DayDots date={d} max={2} />
            </button>
          )
        })}
      </div>

      <div className="relative" style={{ height: (to - from) * HOUR_PX + 8 }}>
        {hours.map((h) => (
          <div
            key={h}
            className="absolute right-0 left-0 flex items-start gap-1"
            style={{ top: (h - from) * HOUR_PX }}
          >
            <span className="w-[30px] -translate-y-1.5 text-[10px] text-ink-subtle">
              {String(h).padStart(2, '0')}
            </span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
        ))}
        <div className="absolute top-0 right-0 bottom-0 flex" style={{ left: AXIS_PX }}>
          {perDay.map((items, i) => (
            <div
              key={i}
              className="relative h-full flex-1 border-l border-hairline first:border-l-0"
            >
              {layoutLanes(items).map(({ item, lane, lanes }) => {
                const palette = paletteOf(item.subject?.color ?? null)
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onPickClass(item, days[i]!)}
                    aria-label={`${item.subject?.name ?? ''} ${formatClock(item.startMin)}`}
                    className={cn(
                      'absolute overflow-hidden rounded-md border-l-2 px-0.5 text-left text-[9px] leading-tight font-semibold',
                      palette.soft,
                      palette.border,
                      palette.inkText,
                      item.cancelled && 'line-through opacity-50',
                    )}
                    style={{
                      top: top(item.startMin) + 1,
                      height: Math.max(14, top(item.endMin) - top(item.startMin) - 2),
                      left: `calc(${(100 * lane) / lanes}% + 1px)`,
                      width: `calc(${100 / lanes}% - 2px)`,
                    }}
                  >
                    {item.subject?.name.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
