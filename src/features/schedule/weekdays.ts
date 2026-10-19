import { useTranslation } from 'react-i18next'

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const

/** Weekday names Monday-first (0 = Monday): "Pon", "Uto"… or "ponedjeljak"… */
export function useWeekdayNames(width: 'short' | 'long'): string[] {
  const { t } = useTranslation()
  return DAYS.map((i) => t(`weekdays.${width}.${i}`))
}
