import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BackHeader } from '@/components/BackHeader'
import { CapIcon, ChevronRightIcon, PlusIcon } from '@/components/icons'
import { useDayBoundary } from '@/features/settings/profile'
import { formatDuration } from '@/features/sources/format'
import { localDay, weekdayOf } from '@/lib/day'
import { currentTeachingPeriod, freeMinutesOn, weeklyClassCount } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { DateTile } from './DateTile'
import { ExceptionSheet } from './ExceptionSheet'
import { clockRange, shortClockRange } from './format'
import { exceptionType, toException, type ExceptionRow } from './model'
import { SlotSheet } from './SlotSheet'
import { useScheduleData } from './useScheduleData'
import { useWeekdayNames } from './weekdays'

/** Dostupnost: weekly free slots, the timetable link and exceptions for single days. */
export function AvailabilityPage() {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const data = useScheduleData()
  const short = useWeekdayNames('short')
  const long = useWeekdayNames('long')
  const [slot, setSlot] = useState<{ open: boolean; id?: string; weekday: number }>({
    open: false,
    weekday: 0,
  })
  const [exception, setException] = useState<{ open: boolean; id?: string }>({ open: false })

  const teaching = currentTeachingPeriod(today, data.periods)
  const classes = data.classes.filter((c) => !teaching || c.row.period_id === teaching.id)
  // How the exception changes its day; a cancelled class is compared with the class held.
  const deltaOf = (e: ExceptionRow) => {
    const input = data.dayInput(e.on_date)
    const log = data.logRows.find((l) => l.id === e.lecture_log_id)
    const held = new Set(input.cancelledEntryIds)
    if (log?.timetable_entry_id) held.delete(log.timetable_entry_id)
    return (
      freeMinutesOn(e.on_date, { ...input, exceptions: [toException(e)] }) -
      freeMinutesOn(e.on_date, { ...input, exceptions: [], cancelledEntryIds: held })
    )
  }
  const upcoming = data.exceptionRows
    .filter((e) => e.on_date >= today)
    .sort((a, b) => a.on_date.localeCompare(b.on_date))

  return (
    <div className="flex flex-col gap-4">
      <BackHeader title={t('availability.title')} fallback="/plan" />
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-tight font-bold">{t('availability.heading')}</h1>
        <p className="text-sm leading-[1.45] text-ink-muted">
          {t('availability.totalBefore')}{' '}
          <b className="text-ink">{formatDuration(t, data.weekMinutes(today))}</b>.{' '}
          {t('availability.totalAfter')}
        </p>
      </div>

      <div className="flex flex-col rounded-card-lg bg-surface px-3.5 py-2">
        {short.map((name, weekday) => {
          const slots = data.ruleRows
            .filter((r) => r.weekday === weekday)
            .sort((a, b) => a.start_min - b.start_min)
          return (
            <div
              key={weekday}
              className={cn(
                'flex items-center gap-2.5 py-2.5',
                weekday < 6 && 'border-b border-hairline',
              )}
            >
              <span className="w-10 text-sm font-semibold">{name}</span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {slots.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSlot({ open: true, id: r.id, weekday })}
                    className="flex h-8 items-center rounded-full bg-brand-soft px-3 text-[13px] font-semibold text-brand-strong"
                  >
                    {shortClockRange(r.start_min, r.end_min)}
                  </button>
                ))}
                {slots.length === 0 && (
                  <span className="flex h-8 items-center text-[13px] text-ink-subtle">
                    {t('availability.freeDay')}
                  </span>
                )}
              </div>
              <button
                type="button"
                aria-label={t('availability.addSlotFor', { day: long[weekday] })}
                onClick={() => setSlot({ open: true, weekday })}
                className="flex size-9 items-center justify-center rounded-full border border-dashed border-line text-brand"
              >
                <PlusIcon size={16} strokeWidth={2} />
              </button>
            </div>
          )
        })}
      </div>

      <Link
        to="/plan/timetable"
        className="flex items-center gap-3 rounded-[22px] bg-surface px-4 py-3.5"
      >
        <div className="flex size-11 items-center justify-center rounded-[14px] bg-subject-blue-soft text-subject-blue-deep">
          <CapIcon size={20} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{t('timetable.title')}</span>
          <span className="text-xs text-ink-muted">
            {t('availability.timetableLine', {
              count: Math.round(weeklyClassCount(classes)),
            })}
          </span>
        </div>
        <ChevronRightIcon size={18} className="text-ink-subtle" />
      </Link>

      <div className="mt-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('availability.exceptions')}</h2>
        <button
          type="button"
          onClick={() => setException({ open: true })}
          className="flex h-10 items-center rounded-full bg-surface px-3.5 text-sm font-semibold text-brand"
        >
          {t('calendar.add')}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {upcoming.length === 0 && (
          <p className="rounded-[20px] bg-surface px-4 py-3.5 text-sm text-ink-muted">
            {t('availability.noExceptions')}
          </p>
        )}
        {upcoming.map((e) => (
          <ExceptionItem
            key={e.id}
            exception={e}
            weekdayName={long[weekdayOf(e.on_date)]!}
            delta={deltaOf(e)}
            onOpen={e.lecture_log_id ? undefined : () => setException({ open: true, id: e.id })}
          />
        ))}
      </div>

      <SlotSheet
        rule={data.ruleRows.find((r) => r.id === slot.id)}
        weekday={slot.weekday}
        open={slot.open}
        onOpenChange={(open) => setSlot((s) => ({ ...s, open }))}
      />
      <ExceptionSheet
        exception={data.exceptionRows.find((e) => e.id === exception.id)}
        date={today}
        open={exception.open}
        onOpenChange={(open) => setException((s) => ({ ...s, open }))}
      />
    </div>
  )
}

function ExceptionItem({
  exception,
  weekdayName,
  delta,
  onOpen,
}: {
  exception: ExceptionRow
  weekdayName: string
  delta: number
  /** Undefined for "class cancelled" exceptions, which belong to a lecture log. */
  onOpen?: () => void
}) {
  const { t } = useTranslation()
  const type = exceptionType(exception)
  const range =
    exception.start_min === null || exception.end_min === null
      ? ''
      : clockRange(exception.start_min, exception.end_min)
  const title = exception.lecture_log_id
    ? t('availability.cancelledClass', { range })
    : t(`availability.item.${type}`, { range })
  const sign = delta > 0 ? '+' : '−'
  const free = type === 'extraFree'
  const content = (
    <>
      <DateTile
        date={exception.on_date}
        className={free ? 'bg-success-soft' : 'bg-subject-pink-soft'}
        dayClass={free ? 'text-subject-green-ink' : 'text-subject-pink-ink'}
        monthClass={free ? 'text-success' : 'text-subject-pink-deep'}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-xs text-ink-muted">
          {delta === 0
            ? t('availability.itemDetailNone', { day: weekdayName })
            : t('availability.itemDetail', {
                day: weekdayName,
                delta: `${sign}${formatDuration(t, Math.abs(delta))}`,
              })}
        </span>
      </div>
    </>
  )
  const className = 'flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5 text-left'
  return onOpen ? (
    <button type="button" onClick={onOpen} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}
