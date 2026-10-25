import type { TFunction } from 'i18next'
import type { Measure } from '@/lib/outline/parse'
import type { Unit } from './model'

/** "~9h 40", "~45 min", "~3h" */
export function formatDuration(t: TFunction, minutes: number) {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return t('time.minutes', { m })
  if (m === 0) return t('time.hours', { h })
  return t('time.hoursMinutes', { h, m: String(m).padStart(2, '0') })
}

/** "412 str.", "34 slajda", "60 pitanja", "12 jedinica" */
export function amountLabel(t: TFunction, measure: Measure, count: number) {
  return t(`sources.amount.${measure}`, { count: Math.round(count) })
}

/** "str. 1–56", "slajdovi 1–20", or null without pages. */
export function pagesLabel(
  t: TFunction,
  measure: Measure,
  unit: Pick<Unit, 'page_start' | 'page_end'>,
) {
  if (unit.page_start === null) return null
  const range =
    unit.page_end === null || unit.page_end === unit.page_start
      ? String(unit.page_start)
      : `${unit.page_start}–${unit.page_end}`
  return t(measure === 'slides' ? 'sources.slidesRange' : 'sources.pagesRange', { range })
}

export function statusLabel(
  t: TFunction,
  kind: Unit['kind'],
  level: number,
  /** A chapter not read yet but started: "Djelimično · 2/9" (decision after 10b). */
  partial?: Pick<Unit, 'amount' | 'read_amount'>,
) {
  const l = Math.min(3, Math.max(0, Math.round(level))) as 0 | 1 | 2 | 3
  const read = Number(partial?.read_amount ?? 0)
  if (kind === 'chapter' && l === 0 && partial && read > 0 && read < partial.amount)
    return t('units.status.partial', { done: read, total: partial.amount })
  return kind === 'question'
    ? t(`units.status.question.${l === 2 ? 1 : l}`)
    : t(`units.status.chapter.${l}`)
}

/** Chip colors per level, from the Izvor mockup. */
export const STATUS_CHIP: Record<number, string> = {
  0: 'bg-canvas text-ink-muted',
  1: 'bg-brand-soft text-avatar-ink',
  2: 'bg-brand-accent text-white',
  3: 'bg-brand text-white',
}
