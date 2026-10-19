import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BackHeader } from '@/components/BackHeader'
import { CapIcon, ChevronRightIcon, PencilIcon } from '@/components/icons'
import { useAgenda } from '@/features/plan/agenda'
import { DayStrip } from '@/features/plan/DayStrip'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { formatDuration } from '@/features/sources/format'
import { localDateOf } from '@/features/subjects/model'
import { localDay, toDisplayDate, weekdayOf } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import {
  capFor,
  currentTeachingPeriod,
  freeMinutesOn,
  slotMinutes,
  slotsFor,
  studyMinutesOn,
  weeklyClassCount,
} from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { AvailabilityTimeline } from './AvailabilityTimeline'
import { DateTile } from './DateTile'
import { DaySheet } from './DaySheet'
import { clockRange, shortClockRange } from './format'
import { useScheduleData } from './useScheduleData'
import { useWeekdayNames } from './weekdays'

/**
 * Dostupnost: a real week with dates and the selected day on a time axis (slots, classes, cap);
 * the weekly template below; dates that differ from it.
 */
export function AvailabilityPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const [selected, setSelected] = useState(() => toDisplayDate(today))
  const date = localDateOf(selected.toISOString())
  const data = useScheduleData()
  const agenda = useAgenda()
  const short = useWeekdayNames('short')
  const long = useWeekdayNames('long')
  const [sheet, setSheet] = useState<{ open: boolean; date?: string; weekday: number }>({
    open: false,
    weekday: 0,
  })
  const editDate = () => setSheet({ open: true, date, weekday: weekdayOf(date) })

  const input = data.dayInput(date)
  const day = data.dayRows.find((d) => d.on_date === date)
  const free = freeMinutesOn(date, input)
  // Slots before classes are taken out, so "8h termina − 2h 15 nastava" explains the free time.
  const slotTotal = slotMinutes(slotsFor(date, input))
  const teaching = currentTeachingPeriod(today, data.periods)
  const classes = data.classes.filter((c) => !teaching || c.row.period_id === teaching.id)
  const changedDays = data.dayRows
    .filter((d) => d.on_date >= today)
    .sort((a, b) => a.on_date.localeCompare(b.on_date))
  const cancelled = data.exceptionRows.filter((e) => e.lecture_log_id && e.on_date >= today)
  const dfLocale = dateFnsLocales[locale]

  return (
    <div className="flex flex-col gap-4">
      <BackHeader title={t('availability.title')} fallback="/plan" />
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-tight font-bold">{t('availability.heading')}</h1>
        <p className="text-sm leading-[1.45] text-ink-muted">
          {t('availability.totalBefore')}{' '}
          <b className="text-ink">{formatDuration(t, data.weekMinutes(date))}</b>{' '}
          {t('availability.totalAfter')}
        </p>
      </div>

      <DayStrip selected={selected} today={toDisplayDate(today)} onSelect={setSelected} />

      <div className="flex flex-col gap-3 rounded-card-lg bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-base font-semibold first-letter:uppercase">
              {format(selected, 'EEEE, d. MMM', { locale: dfLocale })}
            </span>
            <span className="text-[13px] text-ink-muted">
              {t('availability.dayLine', {
                free: formatDuration(t, free),
                cap: formatDuration(t, capFor(date, input)),
              })}
            </span>
            {slotTotal > free && (
              <span className="text-xs text-ink-subtle">
                {t('availability.breakdown', {
                  slots: formatDuration(t, slotTotal),
                  busy: formatDuration(t, slotTotal - free),
                })}
              </span>
            )}
            {day && (
              <span className="self-start rounded-lg bg-brand-soft px-2 py-[3px] text-[11px] font-semibold text-avatar-ink">
                {t('availability.onlyThisDay')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={editDate}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 text-sm font-semibold text-white"
          >
            <PencilIcon size={15} />
            {t('availability.editDay')}
          </button>
        </div>
        <AvailabilityTimeline
          slots={slotsFor(date, input)}
          classes={agenda.classesFor(date)}
          onEdit={editDate}
        />
        <span className="text-xs text-ink-muted">
          {t('availability.planUses', {
            time: formatDuration(t, studyMinutesOn(date, input)),
          })}
        </span>
      </div>

      <div className="mt-1 flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('availability.template')}</h2>
        <span className="text-xs text-ink-muted">{t('availability.templateHint')}</span>
      </div>
      <div className="flex flex-col rounded-card-lg bg-surface px-3.5 py-1.5">
        {short.map((name, weekday) => {
          const rules = data.rules
            .filter((r) => r.weekday === weekday)
            .sort((a, b) => a.startMin - b.startMin)
          return (
            <button
              key={weekday}
              type="button"
              onClick={() => setSheet({ open: true, weekday })}
              aria-label={t('availability.templateFor', { day: long[weekday] })}
              className={cn(
                'flex min-h-12 items-center gap-2.5 py-2 text-left',
                weekday < 6 && 'border-b border-hairline',
              )}
            >
              <span className="w-10 text-sm font-semibold">{name}</span>
              <span className="flex flex-1 flex-wrap gap-1.5">
                {rules.map((r, i) => (
                  <span
                    key={i}
                    className="flex h-7 items-center rounded-full bg-brand-soft px-2.5 text-xs font-semibold text-brand-strong"
                  >
                    {shortClockRange(r.startMin, r.endMin)}
                  </span>
                ))}
                {rules.length === 0 && (
                  <span className="flex h-7 items-center text-xs text-ink-subtle">
                    {t('availability.freeDay')}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold whitespace-nowrap text-ink-muted">
                {t('availability.upTo', { time: formatDuration(t, data.caps[weekday] ?? 0) })}
              </span>
              <ChevronRightIcon size={16} className="text-ink-subtle" />
            </button>
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
            {t('availability.timetableLine', { count: Math.round(weeklyClassCount(classes)) })}
          </span>
        </div>
        <ChevronRightIcon size={18} className="text-ink-subtle" />
      </Link>

      {(changedDays.length > 0 || cancelled.length > 0) && (
        <>
          <h2 className="mt-1 text-lg font-semibold">{t('availability.changedDays')}</h2>
          <div className="flex flex-col gap-2">
            {changedDays.map((d) => {
              const dayInput = data.dayInput(d.on_date)
              const slots = slotsFor(d.on_date, dayInput)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelected(toDisplayDate(d.on_date))}
                  className="flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5 text-left"
                >
                  <DateTile
                    date={d.on_date}
                    className={slots.length ? 'bg-brand-soft' : 'bg-subject-pink-soft'}
                    dayClass={slots.length ? 'text-brand-strong' : 'text-subject-pink-ink'}
                    monthClass={slots.length ? 'text-brand' : 'text-subject-pink-deep'}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">
                      {slots.length
                        ? slots.map((s) => shortClockRange(s.startMin, s.endMin)).join(', ')
                        : t('availability.noStudy')}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {long[weekdayOf(d.on_date)]} ·{' '}
                      {t('availability.upTo', {
                        time: formatDuration(t, capFor(d.on_date, dayInput)),
                      })}
                    </span>
                  </div>
                </button>
              )
            })}
            {cancelled.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5"
              >
                <DateTile
                  date={e.on_date}
                  className="bg-success-soft"
                  dayClass="text-subject-green-ink"
                  monthClass="text-success"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">
                    {t('availability.cancelledClass', {
                      range: clockRange(e.start_min ?? 0, e.end_min ?? 0),
                    })}
                  </span>
                  <span className="text-xs text-ink-muted">{long[weekdayOf(e.on_date)]}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <DaySheet
        date={sheet.date}
        weekday={sheet.weekday}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
    </div>
  )
}
