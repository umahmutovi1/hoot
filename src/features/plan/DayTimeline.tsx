import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { paletteOf } from '@/features/subjects/colors'
import { formatClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { LockIcon } from '@/components/icons'
import type { DayBusy, DayClass } from './agenda'
import type { PlanBlockRow } from './state'
import { layoutLanes } from './calendar'

const HOUR_PX = 52
const AXIS_PX = 50
/** Without "now" or a block the axis opens at the start of a usual day. */
const MORNING_MIN = 8 * 60

/**
 * One day on a time axis (day-view inspiration, Satnica grid): the whole day 00–24 like the iOS
 * calendar, 52 px per hour, cards in the subject's colors, overlapping items side by side, a line at
 * the current time. It opens scrolled to now, the first block or 08:00.
 */
/** A plan block on the axis: its subject's color, done ticked, manual with a lock. */
export interface DayBlock {
  id: string
  startMin: number
  endMin: number
  title: string
  sub: string
  color: string | null
  done: boolean
  manual: boolean
  block: PlanBlockRow
}

export function DayTimeline({
  items,
  busy = [],
  blocks = [],
  nowMin,
  scrollKey,
  onPick,
  onPickBusy,
  onPickBlock,
}: {
  items: DayClass[]
  blocks?: DayBlock[]
  onPickBlock?: (item: DayBlock) => void
  /** Busy time from connected calendars: hatched, with the calendar's name. */
  busy?: DayBusy[]
  nowMin?: number
  /**
   * The day shown: when it changes, the axis scrolls to the "now" line (today), the first block
   * or 08:00.
   */
  scrollKey?: string
  onPick?: (item: DayClass) => void
  onPickBusy?: (item: DayBusy) => void
}) {
  const { t } = useTranslation()
  const from = 0
  const to = 24
  const top = (min: number) => ((min - from * 60) / 60) * HOUR_PX
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const firstBlock = blocks.reduce<number | null>(
    (m, b) => (m === null || b.startMin < m ? b.startMin : m),
    null,
  )
  const inRange = nowMin !== undefined && nowMin >= from * 60 && nowMin <= to * 60
  const target = inRange ? nowMin : (firstBlock ?? MORNING_MIN)
  const anchor = useRef<HTMLDivElement>(null)
  const scrolledFor = useRef<string | null>(null)
  const targetTop = target === null ? null : Math.max(0, top(target) - 30)

  useEffect(() => {
    const el = anchor.current
    if (!el || scrollKey === undefined || targetTop === null) return
    // Once per day shown (as soon as its blocks are there), not on every refresh of the plan.
    if (scrolledFor.current === scrollKey) return
    scrolledFor.current = scrollKey
    // Inside a scrolling card (Plan → Dan) only the axis scrolls; otherwise the page does.
    const box = el.closest<HTMLElement>('[data-timeline-scroll]')
    if (box) {
      box.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: 'smooth' })
      return
    }
    const r = el.getBoundingClientRect()
    if (r.top < 0 || r.top > window.innerHeight * 0.6)
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [scrollKey, targetTop])

  return (
    <div className="relative" style={{ height: (to - from) * HOUR_PX + 12 }}>
      {targetTop !== null && (
        <div
          ref={anchor}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 h-0 scroll-mt-4"
          style={{ top: targetTop }}
        />
      )}
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

      {layoutLanes<DayClass | DayBusy | DayBlock>([...items, ...busy, ...blocks]).map(
        ({ item, lane, lanes }) => {
          const position = {
            top: top(item.startMin) + 2,
            left: `calc(${AXIS_PX + 6}px + (100% - ${AXIS_PX + 6}px) * ${lane / lanes})`,
            width: `calc((100% - ${AXIS_PX + 6}px) / ${lanes} - 4px)`,
          }
          if ('block' in item) {
            const palette = paletteOf(item.color)
            const height = Math.max(36, top(item.endMin) - top(item.startMin) - 4)
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onPickBlock?.(item)}
                className={cn(
                  'absolute flex overflow-hidden rounded-2xl border-l-4 glass px-3 py-2 text-left',
                  palette.border,
                  item.done && 'opacity-60',
                )}
                style={{ ...position, height }}
              >
                <div className={cn('flex min-w-0 flex-col', height < 64 ? 'gap-0' : 'gap-0.5')}>
                  <span className="flex items-center gap-1 truncate text-sm font-semibold">
                    {item.manual && <LockIcon size={12} className="shrink-0 text-ink-muted" />}
                    <span className={cn('truncate', item.done && 'line-through')}>
                      {item.title}
                    </span>
                  </span>
                  <span className="truncate text-[11px] text-ink-muted">{item.sub}</span>
                </div>
              </button>
            )
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
        },
      )}

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
