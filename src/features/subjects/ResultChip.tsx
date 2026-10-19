import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useLocale } from '@/features/settings/useLocale'
import { isCounted, resultShare, suggestPassed, type GradeItem } from '@/lib/grades'
import { cn } from '@/lib/utils'
import { formatPoints } from './grades'

/**
 * Result of an exam or deadline at the end of its row: "32/40 ✓", "12/40 ✗", struck-through
 * when waived, or "Unesi rezultat" once it is due. Nothing before that.
 */
export function ResultChip({
  item,
  worth,
  due,
  onOpen,
}: {
  item: GradeItem
  /** Points the item carries; null shows the raw result. */
  worth: number | null
  /** The exam day has come (or the deadline is done or past). */
  due: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const share = resultShare(item)
  if (share === null && !due) return null
  const chip = 'flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold'
  if (share === null) {
    return (
      <button type="button" onClick={onOpen} className={cn(chip, 'bg-brand-soft text-brand')}>
        {t('grades.enterResult')}
      </button>
    )
  }
  const score = scoreLabel(t, item, worth, locale)
  if (!isCounted(item)) {
    return (
      <button type="button" onClick={onOpen} className={cn(chip, 'bg-canvas text-ink-muted')}>
        <s>{score}</s>&nbsp;· {t('grades.annulled')}
      </button>
    )
  }
  const passed = item.passed ?? suggestPassed(share, item.passMinPct)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        chip,
        passed ? 'bg-success-soft text-subject-green-ink' : 'bg-warning-soft text-warning-ink',
      )}
    >
      {score} {passed ? '✓' : '✗'}
    </button>
  )
}

function scoreLabel(t: TFunction, item: GradeItem, worth: number | null, locale: string) {
  const share = resultShare(item) ?? 0
  return worth === null
    ? t('grades.score', {
        points: formatPoints(item.resultPoints ?? 0, locale),
        max: formatPoints(item.resultMax ?? 0, locale),
      })
    : t('grades.score', {
        points: formatPoints(worth * share, locale),
        max: formatPoints(worth, locale),
      })
}
