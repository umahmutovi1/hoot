import type { TFunction } from 'i18next'
import { format, type Locale as DateFnsLocale } from 'date-fns'
import { toDisplayDate, type LocalDate } from '@/lib/day'
import { formatClock, type PeriodKind } from '@/lib/schedule'
import type { ClassKind } from './model'

/** "6. okt – 23. jan", or one day "25. nov". */
export function dateRangeLabel(from: LocalDate, to: LocalDate, locale: DateFnsLocale) {
  const a = format(toDisplayDate(from), 'd. MMM', { locale })
  if (from === to) return a
  return `${a} – ${format(toDisplayDate(to), 'd. MMM', { locale })}`
}

/** "09:00–11:00" */
export function clockRange(startMin: number, endMin: number) {
  return `${formatClock(startMin)}–${formatClock(endMin)}`
}

/** "09–11" when both are full hours (Dostupnost chips), otherwise "09:30–11:00". */
export function shortClockRange(startMin: number, endMin: number) {
  if (startMin % 60 === 0 && endMin % 60 === 0) {
    const h = (m: number) => String(m / 60).padStart(2, '0')
    return `${h(startMin)}–${h(endMin)}`
  }
  return clockRange(startMin, endMin)
}

/** Winter semester when teaching starts between August and January. */
export function isWinterTerm(startsOn: LocalDate) {
  const month = Number(startsOn.slice(5, 7))
  return month >= 8 || month === 1
}

/** Title suggested for a new period of this kind. */
export function defaultPeriodTitle(
  t: TFunction,
  kind: PeriodKind,
  session: 'regular' | 'makeup' | null,
  startsOn: LocalDate | null,
) {
  if (kind === 'teaching') {
    return t(
      startsOn && !isWinterTerm(startsOn)
        ? 'calendar.defaultTitle.summer'
        : 'calendar.defaultTitle.winter',
    )
  }
  if (kind === 'exam') return t(`calendar.defaultTitle.exam_${session ?? 'regular'}`)
  return t(`calendar.defaultTitle.${kind}`)
}

/** Badge colors per class type, from the Raspored mockup. */
export const CLASS_KIND_STYLE: Record<ClassKind, string> = {
  lecture: 'bg-brand-soft text-avatar-ink',
  exercise: 'bg-success-soft text-subject-green-ink',
  lab: 'bg-warning-soft text-warning-ink',
  other: 'bg-canvas text-ink-muted',
}

/** Date tile colors per period kind. */
export const PERIOD_TILE: Record<PeriodKind, { bg: string; day: string; month: string }> = {
  teaching: { bg: 'bg-brand-soft', day: 'text-brand-strong', month: 'text-brand' },
  partial_exams: {
    bg: 'bg-subject-blue-soft',
    day: 'text-subject-blue-ink',
    month: 'text-subject-blue-deep',
  },
  exam: {
    bg: 'bg-subject-pink-soft',
    day: 'text-subject-pink-ink',
    month: 'text-subject-pink-deep',
  },
  holiday: { bg: 'bg-success-soft', day: 'text-subject-green-ink', month: 'text-success' },
}
