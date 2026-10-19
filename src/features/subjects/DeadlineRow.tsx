import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays, format } from 'date-fns'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { relativeDays } from './format'
import type { Deadline } from './model'

/** Deadline row in the style of the exam rows; the date tile uses the warning tint like the calendar. */
export function DeadlineRow({
  deadline,
  now,
  onOpen,
}: {
  deadline: Deadline
  now: Date
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const due = new Date(deadline.due_at)
  const details = [
    t(`deadlines.kind.${deadline.kind}`),
    deadline.est_minutes !== null &&
      t('deadlines.hours', { hours: Math.round((deadline.est_minutes / 60) * 10) / 10 }),
    deadline.done ? t('deadlines.doneShort') : relativeDays(t, differenceInCalendarDays(due, now)),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 p-3 text-left">
      <div className="flex h-[54px] w-[50px] shrink-0 flex-col items-center justify-center rounded-[16px] bg-warning-soft">
        <span className="text-[19px] leading-none font-bold text-warning">{format(due, 'd')}</span>
        <span className="text-[11px] text-warning">
          {format(due, 'MMM', { locale: dateFnsLocales[locale] })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn('text-[15px] font-semibold', deadline.done && 'line-through opacity-60')}
        >
          {deadline.title}
        </span>
        <span className="text-xs text-ink-muted">{details}</span>
      </div>
    </button>
  )
}
