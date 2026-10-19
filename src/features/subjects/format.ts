import type { TFunction } from 'i18next'

/** "danas" / "sutra" / "za 9 dana" from a calendar-day difference. */
export function relativeDays(t: TFunction, days: number) {
  if (days <= 0) return t('subjects.days.today')
  if (days === 1) return t('subjects.days.tomorrow')
  return t('subjects.days.inDays', { count: days })
}
