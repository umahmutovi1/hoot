import type { TFunction } from 'i18next'
import { format, type Locale as DateFnsLocale } from 'date-fns'
import type { Assessment } from './model'

/** "danas" / "sutra" / "za 9 dana" from a calendar-day difference. */
export function relativeDays(t: TFunction, days: number) {
  if (days <= 0) return t('subjects.days.today')
  if (days === 1) return t('subjects.days.tomorrow')
  return t('subjects.days.inDays', { count: days })
}

/** "28. okt", or "~28. okt – 5. nov" for a tentative exam with a range. */
export function examDateLabel(
  exam: Pick<Assessment, 'at' | 'at_latest' | 'date_tentative'>,
  locale: DateFnsLocale,
) {
  const start = format(new Date(exam.at), 'd. MMM', { locale })
  if (!exam.date_tentative) return start
  if (!exam.at_latest) return `~${start}`
  return `~${start} – ${format(new Date(exam.at_latest), 'd. MMM', { locale })}`
}
