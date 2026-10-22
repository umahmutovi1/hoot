import { useTranslation } from 'react-i18next'
import type { DayBusy, DayClass } from '@/features/plan/agenda'
import { hourRange } from '@/features/plan/calendar'
import { formatClock, type FreeSlot } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { clockRange } from './format'

const HOUR_PX = 30

/**
 * One day of availability: free slots as lavender bands, classes on top (hatched, "iz
 * rasporeda nastave" as in Satnica). Read-only: "Uredi dan" edits the day, so a stray tap (or the
 * tap that dismisses the sheet) never reopens it.
 */
export function AvailabilityTimeline({
  slots,
  classes,
  busy = [],
  onPickBusy,
}: {
  slots: FreeSlot[]
  classes: DayClass[]
  /** Busy time from connected calendars, hatched like classes. */
  busy?: DayBusy[]
  onPickBusy?: (item: DayBusy) => void
}) {
  const { t } = useTranslation()
  const [from, to] = hourRange(
    [...slots.map((s, i) => ({ id: `s${i}`, ...s })), ...classes, ...busy],
    6,
    22,
  )
  const top = (min: number) => ((min - from * 60) / 60) * HOUR_PX
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i)

  return (
    <div className="relative w-full" style={{ height: (to - from) * HOUR_PX + 10 }}>
      {hours.map((h) => (
        <div
          key={h}
          className="absolute right-0 left-0 flex items-start gap-1.5"
          style={{ top: (h - from) * HOUR_PX }}
        >
          <span className="w-10 -translate-y-1.5 text-[10px] text-ink-subtle">
            {formatClock(h * 60)}
          </span>
          <span className="h-px flex-1 bg-hairline" />
        </div>
      ))}
      {slots.map((s, i) => (
        <div
          key={i}
          className={cn(
            'absolute right-1 left-12 rounded-xl border border-brand-accent/40 bg-brand-soft px-2.5 py-1',
            s.overClasses && 'border-dashed',
          )}
          style={{
            top: top(s.startMin) + 1,
            height: Math.max(18, top(s.endMin) - top(s.startMin) - 2),
          }}
        >
          <span className="text-[11px] font-semibold text-brand-strong">
            {clockRange(s.startMin, s.endMin)}
          </span>
        </div>
      ))}
      {classes.map((c) => (
        <div
          key={c.id}
          className={cn(
            'absolute right-4 left-20 overflow-hidden rounded-xl bg-[repeating-linear-gradient(135deg,var(--color-track)_0_8px,var(--color-canvas-soft)_8px_16px)] px-2.5 py-1 shadow-sm',
            c.cancelled && 'opacity-50',
          )}
          style={{
            top: top(c.startMin) + 1,
            height: Math.max(18, top(c.endMin) - top(c.startMin) - 2),
          }}
        >
          <span
            className={cn(
              'block truncate text-[11px] font-semibold text-ink-muted',
              c.cancelled && 'line-through',
            )}
          >
            {c.subject?.name ?? t('timetable.noSubject')} ·{' '}
            {t(`timetable.kind.${c.entry.kind}`).toLowerCase()}
          </span>
        </div>
      ))}
      {busy.map((b) => (
        <button
          type="button"
          key={b.id}
          onClick={() => onPickBusy?.(b)}
          className={cn(
            'absolute right-4 left-20 overflow-hidden rounded-xl bg-[repeating-linear-gradient(135deg,var(--color-track)_0_8px,var(--color-canvas-soft)_8px_16px)] px-2.5 py-1 text-left shadow-sm',
            b.ignored && 'opacity-40',
          )}
          style={{
            top: top(b.startMin) + 1,
            height: Math.max(18, top(b.endMin) - top(b.startMin) - 2),
          }}
        >
          <span
            className={cn(
              'block truncate text-[11px] font-semibold text-ink-muted',
              b.ignored && 'line-through',
            )}
          >
            {b.title ? `${b.title} · ` : ''}
            {t('feeds.fromSource', { source: b.source })}
          </span>
        </button>
      ))}
    </div>
  )
}
