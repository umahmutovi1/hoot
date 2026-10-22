import { BusySheet } from '@/features/calendars/BusySheet'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { addMonths, differenceInCalendarDays, format, isSameDay, startOfMonth } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon, FlagIcon, LockIcon, PlusIcon } from '@/components/icons'
import { formatClock } from '@/lib/schedule'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { DeadlineSheet } from '@/features/subjects/DeadlineSheet'
import { examDateLabel, relativeDays } from '@/features/subjects/format'
import { localDateOf } from '@/features/subjects/model'
import { localDay, toDisplayDate, wallClock } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { ClassDetailSheet } from '@/features/schedule/ClassDetailSheet'
import { statusLabel } from '@/features/schedule/format'
import { useAgenda, type DayBusy, type DayClass } from './agenda'
import { deadlinesAhead, deadlinesOn, examsOn, monthGrid, possibleExamsOn } from './calendar'
import { DayDots } from './DayDots'
import { DayStrip } from './DayStrip'
import { useToast } from '@/components/toast-store'
import { useDeleteBlock } from './actions'
import { BlockSheet } from './BlockSheet'
import { DayTimeline } from './DayTimeline'
import type { PlanBlockRow } from './state'
import { toTimeline, useDayBlocks, type DayBlockView } from './useDayBlocks'

// Day first and default (decision after 8b: Kalendar and Satnica are one calendar).
const VIEWS = ['day', 'month'] as const
type CalendarMode = (typeof VIEWS)[number]

/**
 * Plan: one calendar. Dan (default) is the day's timeline with blocks at the times `placeTimes()`
 * gave them, around classes and calendar busy time (a changed block becomes manual; "Vrati
 * predloženo" drops the day's changed AI blocks so the plan places that material again). Mjesec
 * is the month grid. Below both, the selected day's exams, deadlines and blocks without a time.
 */
export function CalendarView() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const view: CalendarMode = VIEWS.find((v) => v === params.get('view')) ?? 'day'
  const setView = (v: CalendarMode) => setParams(v === 'day' ? {} : { view: v }, { replace: true })
  const [today] = useState(() => new Date())
  const now = useNow()
  // `?date=yyyy-MM-dd` opens a day directly (e.g. "Prikaži u kalendaru" on an exam).
  const [selected, setSelected] = useState(() => {
    const date = params.get('date')
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? toDisplayDate(date) : today
  })
  const [detail, setDetail] = useState<{ item: DayClass; date: string } | null>(null)
  const openClass = (item: DayClass, date: Date) =>
    setDetail({ item, date: localDateOf(date.toISOString()) })
  const agenda = useAgenda()
  const [busy, setBusy] = useState<DayBusy | null>(null)
  const boundary = useDayBoundary()
  const selectedDate = localDateOf(selected.toISOString())
  const dayClasses = agenda.classesFor(selectedDate)
  const dayBlocks = useDayBlocks()
  const blocks = dayBlocks.blocksFor(selectedDate)
  const [sheet, setSheet] = useState<{ open: boolean; block: PlanBlockRow | null }>({
    open: false,
    block: null,
  })
  const openBlock = (block: PlanBlockRow | null) => setSheet({ open: true, block })
  const remove = useDeleteBlock()
  const show = useToast((s) => s.show)
  const edited = blocks.filter((b) => b.edited && b.block.status === 'planned')
  const revert = async () => {
    const undos: (() => Promise<void>)[] = []
    for (const b of edited) undos.push(await remove(b.block, false))
    show(t('plan.schedule.reverted'), {
      label: t('today.cant.undo'),
      run: () => void Promise.all(undos.map((u) => u())),
    })
  }

  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label={t('plan.viewLabel')} className="mb-3 flex gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              'h-9 rounded-full px-4 text-[13px] font-semibold',
              view === v ? 'bg-ink text-white' : 'glass text-ink',
            )}
          >
            {t(`plan.view.${v}`)}
          </button>
        ))}
      </div>

      {view === 'month' && <MonthGrid today={today} selected={selected} onSelect={setSelected} />}
      {view === 'day' && (
        <div className="flex flex-col gap-3">
          <DayStrip selected={selected} today={today} onSelect={setSelected} />
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-xs leading-[1.4] text-ink-muted">
              {t('plan.schedule.note')} · {t('plan.schedule.moved')}
            </span>
            {edited.length > 0 && (
              <button
                type="button"
                onClick={() => void revert()}
                className="flex h-9 shrink-0 items-center rounded-full bg-canvas px-3 text-[13px] font-semibold text-brand"
              >
                {t('plan.schedule.revert')}
              </button>
            )}
          </div>
          <div className="rounded-card-lg glass p-3 pr-2">
            {dayClasses.length === 0 &&
              agenda.busyFor(selectedDate).length === 0 &&
              blocks.length === 0 && (
                <p className="px-1 pb-2 text-sm text-ink-muted">{t('plan.noClasses')}</p>
              )}
            <DayTimeline
              items={dayClasses}
              busy={agenda.busyFor(selectedDate)}
              blocks={toTimeline(blocks)}
              onPickBlock={(b) => openBlock(b.block)}
              onPickBusy={setBusy}
              onPick={(item) => openClass(item, selected)}
              nowMin={
                isSameDay(selected, today) ? wallClock(now, boundary.timeZone).minutes : undefined
              }
            />
          </div>
        </div>
      )}

      <DayDetails
        selected={selected}
        today={today}
        classes={view === 'day' ? [] : dayClasses}
        blocks={view === 'day' ? blocks.filter((b) => b.startMin === null) : blocks}
        onPickBlock={openBlock}
        status={agenda.statusOf(selectedDate)}
        onPickClass={(item) => openClass(item, selected)}
      />
      <BusySheet item={busy} onClose={() => setBusy(null)} />
      <BlockSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        block={sheet.block}
        date={selectedDate}
        today={localDay(today, boundary)}
      />
      <ClassDetailSheet
        item={detail?.item ?? null}
        date={detail?.date ?? selectedDate}
        onClose={() => setDetail(null)}
      />
    </div>
  )
}

/** Current time for the "now" line, refreshed every minute. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function MonthGrid({
  today,
  selected,
  onSelect,
}: {
  today: Date
  selected: Date
  onSelect: (date: Date) => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const dfLocale = dateFnsLocales[locale]
  const { data: subjects = [] } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  const [month, setMonth] = useState(() => startOfMonth(selected))
  const dayBlocks = useDayBlocks()
  const cells = monthGrid(month)
  const weekdays = cells.slice(0, 7).map((c) => format(c.date, 'EEEEE', { locale: dfLocale }))

  return (
    <div className="flex flex-col gap-3 rounded-card-lg glass p-4">
      <div className="flex items-center justify-between">
        <h2 className="pl-1 text-lg font-semibold first-letter:uppercase" aria-live="polite">
          {format(month, 'LLLL yyyy', { locale: dfLocale })}
        </h2>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label={t('plan.prevMonth')}
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="flex size-10 items-center justify-center rounded-full border border-line"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            type="button"
            aria-label={t('plan.nextMonth')}
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="flex size-10 items-center justify-center rounded-full border border-line"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-muted">
        {weekdays.map((w, i) => (
          <span key={i}>{w.toUpperCase()}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }) => {
          const isSelected = isSameDay(date, selected)
          const isToday = isSameDay(date, today)
          const counts = inMonth
            ? {
                exam: examsOn(date, subjects).length,
                possible: possibleExamsOn(date, subjects).length,
                deadline: deadlinesOn(date, deadlines).length,
              }
            : { exam: 0, possible: 0, deadline: 0 }
          const label = [
            format(date, 'd. MMMM', { locale: dfLocale }),
            ...(['exam', 'possible', 'deadline'] as const)
              .filter((k) => counts[k] > 0)
              .map((k) => t(`plan.dayCount.${k}`, { count: counts[k] })),
          ].join(', ')
          return (
            <button
              key={date.toISOString()}
              type="button"
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => {
                onSelect(date)
                if (!inMonth) setMonth(startOfMonth(date))
              }}
              className="flex h-[52px] flex-col items-center justify-start gap-[3px] pt-0.5"
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-full text-[15px]',
                  isSelected
                    ? 'bg-ink font-bold text-white'
                    : isToday
                      ? 'bg-brand-soft font-bold'
                      : 'font-medium',
                  !inMonth && !isSelected && 'text-ink-placeholder',
                )}
              >
                {format(date, 'd')}
              </span>
              {inMonth ? (
                <DayDots
                  date={date}
                  planned={dayBlocks.hasBlocks(localDateOf(date.toISOString()))}
                />
              ) : (
                <span className="h-[7px]" />
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3.5 px-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink-muted" />
          {t('plan.legendExam')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full border-[1.5px] border-ink-muted glass" />
          {t('plan.legendPossibleExam')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" />
          {t('plan.legendDeadline')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brand-accent" />
          {t('plan.legendPlanned')}
        </span>
      </div>
    </div>
  )
}

/** The selected day: calendar status, exams, possible exams, classes and deadlines. */
function DayDetails({
  selected,
  today,
  classes,
  blocks,
  onPickBlock,
  status,
  onPickClass,
}: {
  selected: Date
  today: Date
  classes: DayClass[]
  blocks: DayBlockView[]
  onPickBlock: (block: PlanBlockRow | null) => void
  onPickClass: (item: DayClass) => void
  status: ReturnType<ReturnType<typeof useAgenda>['statusOf']>
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const dfLocale = dateFnsLocales[locale]
  const { data: subjects = [] } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  const [sheet, setSheet] = useState<{ open: boolean; id?: string }>({ open: false })
  const dayExams = examsOn(selected, subjects)
  const dayPossible = possibleExamsOn(selected, subjects)
  const dayDeadlines = deadlinesAhead(selected, deadlines)
  const empty =
    dayExams.length === 0 &&
    dayPossible.length === 0 &&
    dayDeadlines.length === 0 &&
    classes.length === 0 &&
    blocks.length === 0

  return (
    <>
      <div className="mt-5 mb-2.5 flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold first-letter:uppercase">
          {format(selected, 'EEEE, d. MMMM', { locale: dfLocale })}
        </h2>
        {status && <span className="text-[13px] text-ink-muted">{statusLabel(t, status)}</span>}
      </div>
      <div className="flex flex-col gap-2">
        {empty && (
          <p className="rounded-[20px] glass px-4 py-3.5 text-sm text-ink-muted">
            {t('plan.dayEmpty')}
          </p>
        )}
        {dayExams.map(({ exam, subject }) => {
          const palette = paletteOf(subject.color)
          return (
            <Link
              key={exam.id}
              to={`/subjects/${subject.id}`}
              className={cn('flex items-center gap-3 rounded-[20px] px-4 py-3.5', palette.soft)}
            >
              <span className={cn('size-2.5 shrink-0 rounded-full', palette.bar)} />
              <div className="flex flex-col gap-0.5">
                <span className={cn('text-[15px] font-semibold', palette.inkText)}>
                  {t('plan.examItem', { subject: subject.name, title: exam.title })}
                </span>
                <span className="text-xs text-ink-muted">
                  {[
                    t(`subjects.format.${exam.format}`),
                    exam.date_tentative && t('subjects.detail.tentative'),
                    exam.contingent && t('subjects.detail.contingent'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            </Link>
          )
        })}
        {dayPossible.map(({ exam, subject }) => {
          const palette = paletteOf(subject.color)
          return (
            <div
              key={exam.id}
              className="flex items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-line glass px-4 py-3.5"
            >
              <span className={cn('size-2.5 shrink-0 rounded-full', palette.bar)} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">
                  {t('plan.possibleExamItem', { subject: subject.name, title: exam.title })}
                </span>
                <span className="text-xs text-ink-muted">
                  {t('plan.possibleExamRange', { range: examDateLabel(exam, dfLocale).slice(1) })}
                </span>
              </div>
            </div>
          )
        })}
        {classes.map((c) => {
          const palette = paletteOf(c.subject?.color ?? null)
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => onPickClass(c)}
              className="flex items-center gap-3 rounded-[20px] glass px-4 py-3.5 text-left"
            >
              <span className={cn('w-1 self-stretch rounded-full', palette.bar)} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className={cn('text-[15px] font-semibold', c.cancelled && 'line-through')}>
                  {c.subject?.name ?? t('timetable.noSubject')}
                </span>
                <span className="text-xs text-ink-muted">
                  {[
                    `${formatClock(c.startMin)}–${formatClock(c.endMin)}`,
                    t(`timetable.kind.${c.entry.kind}`),
                    c.entry.row.location,
                    c.cancelled && t('plan.cancelled'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            </button>
          )
        })}
        {blocks.map((b) => {
          const palette = paletteOf(b.color)
          return (
            <button
              type="button"
              key={b.block.id}
              onClick={() => onPickBlock(b.block)}
              className="flex items-center gap-3 rounded-[20px] glass px-4 py-3.5 text-left"
            >
              <span className={cn('w-1 self-stretch rounded-full', palette.bar)} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    'truncate text-[15px] font-semibold',
                    b.done && 'line-through opacity-60',
                  )}
                >
                  {b.title}
                </span>
                <span className="truncate text-xs text-ink-muted">
                  {[b.sub, b.startMin === null ? null : formatClock(b.startMin)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {b.manual && <LockIcon size={16} className="shrink-0 text-ink-muted" />}
            </button>
          )
        })}
        {dayDeadlines.map((d) => {
          const due = new Date(d.due_at)
          const subject = subjects.find((s) => s.id === d.subject_id)
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setSheet({ open: true, id: d.id })}
              className="flex items-center gap-3 rounded-[20px] bg-warning-soft px-4 py-3.5 text-left"
            >
              <FlagIcon size={18} className="shrink-0 text-warning" />
              <div className="flex flex-col gap-0.5">
                <span
                  className={cn(
                    'text-[15px] font-semibold text-warning-ink',
                    d.done && 'line-through opacity-60',
                  )}
                >
                  {subject
                    ? t('plan.deadlineItemSubject', { title: d.title, subject: subject.name })
                    : t('plan.deadlineItem', { title: d.title })}
                </span>
                <span className="text-xs text-warning-muted">
                  {format(due, 'EEEE, d. MMM', { locale: dfLocale })} ·{' '}
                  {relativeDays(t, differenceInCalendarDays(due, today))}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => onPickBlock(null)}
          className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-line text-[15px] font-semibold"
        >
          <PlusIcon size={16} className="text-brand" />
          {t('blockSheet.add')}
        </button>
        <button
          type="button"
          onClick={() => setSheet({ open: true })}
          className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-line text-[15px] font-semibold"
        >
          <PlusIcon size={16} className="text-brand" />
          {t('plan.addDeadline')}
        </button>
      </div>

      <DeadlineSheet
        deadline={deadlines.find((d) => d.id === sheet.id)}
        date={localDateOf(selected.toISOString())}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
    </>
  )
}
