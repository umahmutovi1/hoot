import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addMonths, differenceInCalendarDays, format, isSameDay, startOfMonth } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon, FlagIcon, PlusIcon } from '@/components/icons'
import { useLocale } from '@/features/settings/useLocale'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { DeadlineSheet } from '@/features/subjects/DeadlineSheet'
import { examDateLabel, relativeDays } from '@/features/subjects/format'
import { localDateOf } from '@/features/subjects/model'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import {
  dayMarkers,
  deadlinesAhead,
  deadlinesOn,
  examsOn,
  monthGrid,
  possibleExamsOn,
} from './calendar'

/** Plan → Kalendar: month grid with exams and deadlines, and the selected day's list. */
export function CalendarView() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const dfLocale = dateFnsLocales[locale]
  const { data: subjects = [] } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selected, setSelected] = useState(today)
  const [sheet, setSheet] = useState<{ open: boolean; id?: string }>({ open: false })

  const cells = monthGrid(month)
  const weekdays = cells.slice(0, 7).map((c) => format(c.date, 'EEEEE', { locale: dfLocale }))
  const dayExams = examsOn(selected, subjects)
  const dayPossible = possibleExamsOn(selected, subjects)
  const dayDeadlines = deadlinesAhead(selected, deadlines)

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 rounded-card-lg bg-surface p-4">
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
            const markers = inMonth ? dayMarkers(date, subjects, deadlines) : null
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
                  setSelected(date)
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
                <span aria-hidden="true" className="flex h-[7px] items-center gap-[3px]">
                  {markers?.visible.map((m) => (
                    <span
                      key={`${m.kind}-${m.id}`}
                      className={cn(
                        'size-[6px] rounded-full',
                        m.kind === 'exam' && paletteOf(m.color).bar,
                        m.kind === 'possible' && 'border-[1.5px] bg-surface',
                        m.kind === 'possible' && paletteOf(m.color).border,
                        m.kind === 'deadline' && 'bg-warning',
                      )}
                    />
                  ))}
                  {markers && markers.more > 0 && (
                    <span className="text-[9px] leading-none font-bold text-ink-muted">
                      +{markers.more}
                    </span>
                  )}
                </span>
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
            <span className="size-2 rounded-full border-[1.5px] border-ink-muted bg-surface" />
            {t('plan.legendPossibleExam')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" />
            {t('plan.legendDeadline')}
          </span>
        </div>
      </div>

      <h2 className="mt-5 mb-2.5 text-lg font-semibold first-letter:uppercase">
        {format(selected, 'EEEE, d. MMMM', { locale: dfLocale })}
      </h2>
      <div className="flex flex-col gap-2">
        {dayExams.length === 0 && dayPossible.length === 0 && dayDeadlines.length === 0 && (
          <p className="rounded-[20px] bg-surface px-4 py-3.5 text-sm text-ink-muted">
            {t('plan.dayEmpty')}
          </p>
        )}
        {dayExams.map(({ exam, subject }) => {
          const palette = paletteOf(subject.color)
          return (
            <div
              key={exam.id}
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
            </div>
          )
        })}
        {dayPossible.map(({ exam, subject }) => {
          const palette = paletteOf(subject.color)
          return (
            <div
              key={exam.id}
              className="flex items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-line bg-surface px-4 py-3.5"
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

      <button
        type="button"
        onClick={() => setSheet({ open: true })}
        className="mt-2.5 flex h-[52px] items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-line text-[15px] font-semibold"
      >
        <PlusIcon size={16} className="text-brand" />
        {t('plan.addDeadline')}
      </button>

      <DeadlineSheet
        deadline={deadlines.find((d) => d.id === sheet.id)}
        date={localDateOf(selected.toISOString())}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
    </div>
  )
}
