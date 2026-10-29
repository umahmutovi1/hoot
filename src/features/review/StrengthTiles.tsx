import { useTranslation } from 'react-i18next'
import { useDayBoundary, useFsrsParams } from '@/features/settings/profile'
import type { Card, Unit } from '@/features/sources/model'
import { format } from 'date-fns'
import { toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { useLocale } from '@/features/settings/useLocale'
import { strengthBand, REPEATED_AFTER } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { BAND_BG } from './bands'
import { strengthOf } from './strength'

/** Jedinica: strength today (with its cards) and the next review ("korak 2 od 4"). */
export function StrengthTiles({
  unit,
  cards,
  today,
}: {
  unit: Unit
  cards: Card[]
  today: string
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const boundary = useDayBoundary()
  const params = useFsrsParams()
  const r = strengthOf(unit, cards, today, boundary, params)
  const band = r === null ? null : strengthBand(r)
  // Questions have no reading step: before a test they are just untested.
  const unread = unit.kind === 'chapter' && unit.level === 0
  const next = [unit.next_review_on, ...cards.map((c) => c.next_review_on)]
    .filter((d): d is string => d !== null)
    .sort()[0]
  return (
    <>
      <div className="flex flex-col gap-1.5 rounded-[22px] glass p-3.5">
        <span className="text-xs text-ink-muted">{t('strength.title')}</span>
        {r === null ? (
          // No strength before the first test: say what is missing instead of a dash.
          <>
            <span className="text-[15px] leading-snug font-semibold">
              {t(unread ? 'strength.notRead' : 'strength.notTested')}
            </span>
            <span className="text-xs leading-[1.35] text-ink-muted">
              {t(unread ? 'strength.notReadSub' : 'strength.notTestedSub')}
            </span>
          </>
        ) : (
          <>
            <span className="text-[22px] font-bold">{`${Math.round(r * 100)}%`}</span>
            {band && (
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span className={cn('size-2.5 rounded-[3px]', BAND_BG[band])} />
                {t(`strength.band.${band}`)}
              </span>
            )}
          </>
        )}
      </div>
      <div className="flex flex-col gap-1.5 rounded-[22px] glass p-3.5">
        <span className="text-xs text-ink-muted">{t('strength.nextReview')}</span>
        {next ? (
          <span className="text-[22px] font-bold">
            {format(toDisplayDate(next), 'd. MMM', { locale: dateFnsLocales[locale] })}
          </span>
        ) : (
          <span className="text-[15px] leading-snug font-semibold">
            {t(unread ? 'strength.nextAfterRead' : 'strength.nextAfterTest')}
          </span>
        )}
        {unit.fsrs_stability !== null && unit.kind === 'chapter' && (
          <span className="text-xs text-ink-muted">
            {t('strength.step', { n: Math.min(REPEATED_AFTER, Math.max(1, unit.review_streak)) })}
          </span>
        )}
      </div>
    </>
  )
}
