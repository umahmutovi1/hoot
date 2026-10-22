import { useTranslation } from 'react-i18next'
import { paletteOf } from '@/features/subjects/colors'
import { formatClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import type { DayBusy, DayClass } from './agenda'
import { hourRange, layoutLanes } from './calendar'

const HOUR_PX = 52
const AXIS_PX = 50

/**
 * One day on a time axis (day-view inspiration, Satnica grid): 52 px per hour, cards in the
 * subject's colors, overlapping items side by side, a line at the current time.
 */
export function DayTimeline({
  items,
  busy = [],
  nowMin,
  onPick,
  onPickBusy,
}: {
  items: DayClass[]
  /** Busy time from connected calendars: hatched, with the calendar's name. */
  busy?: DayBusy[]
  nowMin?: number
  onPick?: (item: DayClass) => void
  onPickBusy?: (item: DayBusy) => void
}) {
  const { t } = useTranslation()
  const [from, to] = hourRange([...items, ...busy])
  const top = (min: number) => ((min - from * 60) / 60) * HOUR_PX
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i)

  return (
    <div className="relative" style={{ height: (to - from) * HOUR_PX + 12 }}>
      {hours.map((h) => (
        <div
          key={h}
          className="absolute right-0 left-0 flex items-start gap-1.5"
          style={{ top: (h - from) * HOUR_PX }}
        >
          <span className="w-11 -translate-y-1.5 text-[11px] text-ink-subtle">
            {formatClock(h * 60)}
          </span>
          <span className="h-px flex-1 bg-track" />
        </div>
      ))}

      {layoutLanes<DayClass | DayBusy>([...items, ...busy]).map(({ item, lane, lanes }) => {
        const position = {
          top: top(item.startMin) + 2,
          left: `calc(${AXIS_PX + 6}px + (100% - ${AXIS_PX + 6}px) * ${lane / lanes})`,
          width: `calc((100% - ${AXIS_PX + 6}px) / ${lanes} - 4px)`,
        }
        if ('eventId' in item)
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onPickBusy?.(item)}
              className={cn(
                'absolute flex overflow-hidden rounded-2xl bg-[repeating-linear-gradient(135deg,var(--color-track)_0_8px,var(--color-canvas-soft)_8px_16px)] px-3 py-2 text-left',
                item.ignored && 'opacity-40',
              )}
              style={{
                ...position,
                height: Math.max(36, top(item.endMin) - top(item.startMin) - 4),
              }}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[11px] text-ink-muted">
                  {formatClock(item.startMin)} – {formatClock(item.endMin)}
                </span>
                <span
                  className={cn(
                    'truncate text-sm font-semibold text-ink-secondary',
                    item.ignored && 'line-through',
                  )}
                >
                  {item.title ?? t('feeds.busy')}
                </span>
                <span className="truncate text-[11px] text-ink-muted">
                  {t('feeds.fromSource', { source: item.source })}
                </span>
              </div>
            </button>
          )
        const palette = paletteOf(item.subject?.color ?? null)
        const height = Math.max(36, top(item.endMin) - top(item.startMin) - 4)
        const compact = height < 64
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onPick?.(item)}
            className={cn(
              'absolute flex overflow-hidden rounded-2xl border-l-4 px-3 py-2 text-left',
              palette.soft,
              palette.border,
              item.cancelled && 'opacity-60',
            )}
            style={{ ...position, height }}
          >
            <div className={cn('flex min-w-0 flex-col', compact ? 'gap-0' : 'gap-0.5')}>
              <span className={cn('text-[11px]', palette.deepText)}>
                {formatClock(item.startMin)} – {formatClock(item.endMin)}
                {item.cancelled && ` · ${t('plan.cancelled')}`}
              </span>
              <span
                className={cn(
                  'truncate text-sm font-semibold',
                  palette.inkText,
                  item.cancelled && 'line-through',
                )}
              >
                {item.subject?.name ?? t('timetable.noSubject')}
              </span>
              {!compact && (
                <span className="truncate text-[11px] text-ink-muted">
                  {[t(`timetable.kind.${item.entry.kind}`), item.entry.row.location]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </div>
          </button>
        )
      })}

      {nowMin !== undefined && nowMin >= from * 60 && nowMin <= to * 60 && (
        <div
          aria-hidden="true"
          className="absolute right-0 flex items-center"
          style={{ top: top(nowMin) - 5, left: AXIS_PX - 6 }}
        >
          <span className="size-2.5 rounded-full bg-subject-pink" />
          <span className="h-0.5 flex-1 bg-subject-pink" />
        </div>
      )}
    </div>
  )
}
