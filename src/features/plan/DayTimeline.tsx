import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { paletteOf } from '@/features/subjects/colors'
import { formatClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { LockIcon, PencilIcon } from '@/components/icons'
import type { DayBusy, DayClass } from './agenda'
import type { PlanBlockRow } from './state'
import { layoutLanes } from './calendar'

const HOUR_PX = 52
const AXIS_PX = 50
/** Without "now" or a block the axis opens at the start of a usual day. */
const MORNING_MIN = 8 * 60
/** A short item still gets one readable line ("09:00 Matematika"). */
const MIN_CARD_PX = 26
const HATCH =
  'bg-[repeating-linear-gradient(135deg,var(--color-track)_0_8px,var(--color-canvas-soft)_8px_16px)]'

/** One item on the axis, whatever it is: a plan block, a class or busy time. */
interface Card {
  id: string
  startMin: number
  endMin: number
  tone: 'block' | 'class' | 'busy'
  time: string
  title: string
  /** Details: shown in full when the card is expanded, the first one on a tall card. */
  lines: string[]
  surface: string
  border: string
  timeText: string
  titleText: string
  faded: boolean
  strike: boolean
  lock: boolean
  /** The expanded card's button: Uredi (block), Detalji (class), Promijeni vrstu (busy). */
  action: { label: string; icon?: ReactNode; run: () => void } | null
}

/**
 * One day on a time axis (day-view inspiration, Satnica grid): the whole day 00–24 like the iOS
 * calendar, 52 px per hour, cards in the subject's colors, overlapping items side by side, a line at
 * the current time. It opens scrolled to now, the first block or 08:00. A tap expands a card to
 * the full width with all its details and one action (Uredi, Detalji, Promijeni vrstu).
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
  onPickEmpty,
  emptyLabel,
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
  /** A tap on free space on the axis (Plan → Dan opens "Uredi dan"). */
  onPickEmpty?: () => void
  emptyLabel?: string
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

  const [expanded, setExpanded] = useState<string | null>(null)
  const range = (a: number, b: number) => `${formatClock(a)} – ${formatClock(b)}`
  const cards: Card[] = [
    ...blocks.map((b): Card => {
      const palette = paletteOf(b.color)
      return {
        id: b.id,
        startMin: b.startMin,
        endMin: b.endMin,
        tone: 'block',
        time: range(b.startMin, b.endMin),
        // "Statistika — Poglavlje 5": the dash stays with the subject when the title wraps.
        title: b.title.replace(' — ', '\u00a0— '),
        lines: b.sub ? [b.sub] : [],
        surface: 'glass',
        border: palette.border,
        timeText: 'text-ink-muted',
        titleText: 'text-ink',
        faded: b.done,
        strike: b.done,
        lock: b.manual,
        action: onPickBlock
          ? {
              label: t('plan.timeline.edit'),
              icon: <PencilIcon size={14} />,
              run: () => onPickBlock(b),
            }
          : null,
      }
    }),
    ...items.map((c): Card => {
      const palette = paletteOf(c.subject?.color ?? null)
      return {
        id: c.id,
        startMin: c.startMin,
        endMin: c.endMin,
        tone: 'class',
        time: c.cancelled
          ? `${range(c.startMin, c.endMin)} · ${t('plan.cancelled')}`
          : range(c.startMin, c.endMin),
        title: c.subject?.name ?? t('timetable.noSubject'),
        lines: [
          [t(`timetable.kind.${c.entry.kind}`), c.entry.row.location].filter(Boolean).join(' · '),
        ],
        surface: palette.soft,
        border: palette.border,
        timeText: palette.deepText,
        titleText: palette.inkText,
        faded: c.cancelled,
        strike: c.cancelled,
        lock: false,
        action: onPick ? { label: t('plan.timeline.details'), run: () => onPick(c) } : null,
      }
    }),
    ...busy.map((e): Card => ({
      id: e.id,
      startMin: e.startMin,
      endMin: e.endMin,
      tone: 'busy',
      time: range(e.startMin, e.endMin),
      title: e.title ?? t('feeds.busy'),
      lines: [
        e.google
          ? t('googleCalendar.fromGoogle', { source: e.source })
          : t('feeds.fromSource', { source: e.source }),
        t(`feeds.kindOf.${e.kind}`),
      ],
      surface: '',
      border: '',
      timeText: 'text-ink-muted',
      titleText: 'text-ink-secondary',
      faded: e.ignored,
      strike: e.ignored,
      lock: false,
      action: onPickBusy ? { label: t('feeds.kindOf.change'), run: () => onPickBusy(e) } : null,
    })),
  ]

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
      {onPickEmpty && (
        <button
          type="button"
          aria-label={emptyLabel}
          onClick={() => (expanded ? setExpanded(null) : onPickEmpty())}
          className="absolute inset-0 cursor-default"
        />
      )}
      {hours.map((h) => (
        <div
          key={h}
          className="pointer-events-none absolute right-0 left-0 flex items-start gap-1.5"
          style={{ top: (h - from) * HOUR_PX }}
        >
          <span className="w-11 -translate-y-1.5 text-[11px] text-ink-subtle">
            {formatClock(h * 60)}
          </span>
          <span className="h-px flex-1 bg-track" />
        </div>
      ))}

      {layoutLanes(cards).map(({ item: card, lane, lanes }) => {
        const height = Math.max(MIN_CARD_PX, top(card.endMin) - top(card.startMin) - 3)
        const open = expanded === card.id
        // Expanded: the whole width, its full height, above the rest; the action opens the sheet.
        const position = open
          ? { top: top(card.startMin) + 1.5, left: AXIS_PX + 6, right: 0, minHeight: height }
          : {
              top: top(card.startMin) + 1.5,
              left: `calc(${AXIS_PX + 6}px + (100% - ${AXIS_PX + 6}px) * ${lane / lanes})`,
              width: `calc((100% - ${AXIS_PX + 6}px) / ${lanes} - 3px)`,
              height,
            }
        const single = !open && height < 44
        const roomy = !open && height >= 70
        // Side by side the range does not fit: the start is enough until the card is opened, and
        // the title gets the room of the details line.
        const narrow = !open && lanes > 1
        const time = narrow ? formatClock(card.startMin) : card.time
        return (
          <div
            key={card.id}
            className={cn(
              'absolute flex flex-col overflow-hidden rounded-[10px] text-left',
              card.tone === 'busy' && !open && HATCH,
              card.tone !== 'busy' && 'border-l-4',
              card.border,
              open ? 'z-20 glass-strong shadow-lg' : card.surface,
              card.faded && !open && 'opacity-55',
            )}
            style={position}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpanded(open ? null : card.id)}
              className={cn(
                'flex min-w-0 flex-1 flex-col text-left',
                single ? 'justify-center px-2 py-0.5' : 'gap-0.5 px-2.5 py-1.5',
              )}
            >
              {single ? (
                <span className={cn('truncate text-[12px] font-semibold', card.titleText)}>
                  <span className={cn('font-medium', card.timeText)}>{time}</span> {card.title}
                </span>
              ) : (
                <>
                  <span className={cn('truncate text-[11px] leading-tight', card.timeText)}>
                    {time}
                  </span>
                  <span
                    className={cn(
                      'flex min-w-0 items-start gap-1 text-[13px] leading-snug font-semibold',
                      card.titleText,
                    )}
                  >
                    {card.lock && (
                      <LockIcon size={12} className="mt-[3px] shrink-0 text-ink-muted" />
                    )}
                    <span
                      className={cn(
                        open
                          ? 'break-words'
                          : roomy
                            ? narrow
                              ? 'line-clamp-3'
                              : 'line-clamp-2'
                            : 'truncate',
                        card.strike && 'line-through',
                      )}
                    >
                      {card.title}
                    </span>
                  </span>
                  {(open ? card.lines : roomy && !narrow ? card.lines.slice(0, 1) : []).map(
                    (line) => (
                      <span
                        key={line}
                        className={cn(
                          'text-[11px] leading-snug text-ink-muted',
                          open ? 'break-words' : 'truncate',
                        )}
                      >
                        {line}
                      </span>
                    ),
                  )}
                </>
              )}
            </button>
            {open && card.action && (
              <div className="flex gap-1.5 px-2.5 pb-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(null)
                    card.action!.run()
                  }}
                  className="flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-white"
                >
                  {card.action.icon}
                  {card.action.label}
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(null)}
                  className="h-11 rounded-full bg-white/60 px-4 text-[13px] font-semibold"
                >
                  {t('common.close')}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {nowMin !== undefined && nowMin >= from * 60 && nowMin <= to * 60 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 flex items-center"
          style={{ top: top(nowMin) - 5, left: AXIS_PX - 6 }}
        >
          <span className="size-2.5 rounded-full bg-subject-pink" />
          <span className="h-0.5 flex-1 bg-subject-pink" />
        </div>
      )}
    </div>
  )
}
