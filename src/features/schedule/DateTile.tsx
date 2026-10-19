import { format } from 'date-fns'
import { useLocale } from '@/features/settings/useLocale'
import { toDisplayDate, type LocalDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'

/** 44×48 day + month tile, as in the Dostupnost exceptions list. */
export function DateTile({
  date,
  className,
  dayClass,
  monthClass,
}: {
  date: LocalDate
  className: string
  dayClass: string
  monthClass: string
}) {
  const { locale } = useLocale()
  const d = toDisplayDate(date)
  return (
    <div
      className={cn(
        'flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-[14px]',
        className,
      )}
    >
      <span className={cn('text-[17px] leading-none font-bold', dayClass)}>{format(d, 'd')}</span>
      <span className={cn('text-[11px]', monthClass)}>
        {format(d, 'MMM', { locale: dateFnsLocales[locale] })}
      </span>
    </div>
  )
}
