import { useTranslation } from 'react-i18next'
import { useCardReviews } from '@/features/plan/api'
import { useDayBoundary } from '@/features/settings/profile'
import type { SourceMaterial } from '@/features/sources/model'
import type { LocalDate } from '@/lib/day'
import { leavesOf } from '@/lib/progress'
import { reviewMinutes } from '@/lib/scheduler'
import { cn } from '@/lib/utils'
import { BAND_BG, BANDS } from './bands'
import { strengthSummary } from './strength'
import { useStartCheck } from './useStartCheck'

/**
 * Predmet → "Jačina znanja": minute-weighted strength of the units in review, one segment per
 * unit in outline order, and a check of the ones that need it (PRD "Jačina na ekranima").
 */
export function StrengthCard({
  subjectId,
  materials,
  today,
}: {
  subjectId: string
  materials: SourceMaterial[]
  today: LocalDate
}) {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const { data: cards = [] } = useCardReviews()
  const startCheck = useStartCheck()
  const leaves = materials.flatMap((m) =>
    leavesOf(m.units.map((u) => ({ ...u, parentId: u.parent_id }))).map((u) => ({
      unit: u,
      minutes: u.minutes,
    })),
  )
  const ids = new Set(leaves.map((l) => l.unit.id))
  const summary = strengthSummary(
    leaves,
    cards.filter((c) => ids.has(c.unit_id)),
    today,
    boundary,
  )
  if (summary.average === null && summary.needCheck.length === 0) {
    if (!leaves.some((l) => l.unit.level >= 1)) return null
    return (
      <div className="flex flex-col gap-1.5 rounded-card glass p-4">
        <span className="text-[15px] font-semibold">{t('strength.title')}</span>
        <span className="text-[13px] text-ink-muted">{t('strength.empty')}</span>
      </div>
    )
  }
  const check = summary.needCheck
  const checkMinutes = check.reduce(
    (s, x) => s + reviewMinutes(x.unit.kind === 'question' ? 'question' : 'chapter', x.minutes),
    0,
  )
  const first = summary.units[0]?.unit
  const last = summary.units.at(-1)?.unit
  const name = (u: typeof first) => (u ? [u.label, u.title].filter(Boolean).join(' ') : '')

  return (
    <div className="flex flex-col gap-3 rounded-card glass p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold">{t('strength.title')}</span>
        <span className="text-xs text-ink-muted">{t('strength.scope')}</span>
      </div>
      {summary.average !== null && (
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-bold">{Math.round(summary.average * 100)}%</span>
          <span className="text-[13px] text-ink-muted">{t('strength.avg')}</span>
        </div>
      )}
      {summary.units.length > 0 && (
        <>
          <div
            role="img"
            aria-label={t('strength.aria', {
              strong: summary.units.filter((u) => u.band === 'strong').length,
              check: check.length,
            })}
            className="flex h-3.5 gap-[3px]"
          >
            {summary.units.map((u) => (
              <span key={u.unit.id} className={cn('flex-1 rounded-[5px]', BAND_BG[u.band])} />
            ))}
          </div>
          <div className="flex justify-between gap-2 text-[11px] text-ink-secondary">
            <span className="truncate">{name(first)}</span>
            {last !== first && <span className="truncate">{name(last)}</span>}
          </div>
          <div className="flex flex-wrap gap-3.5 text-[11px] text-ink-secondary">
            {BANDS.map((b) => (
              <span key={b} className="flex items-center gap-1.5">
                <span className={cn('size-2.5 rounded-[3px]', BAND_BG[b])} />
                {t(`strength.band.${b}`)}
              </span>
            ))}
          </div>
        </>
      )}
      <span className="text-[13px] text-ink-secondary">
        {check.length > 0
          ? t('strength.needCheck', { count: check.length })
          : t('strength.allGood')}
      </span>
      {check.length > 0 && (
        <button
          type="button"
          onClick={() =>
            void startCheck(
              subjectId,
              check.map((x) => x.unit.id),
              checkMinutes,
            )
          }
          className="flex h-12 items-center justify-center rounded-full btn-primary text-[15px] font-semibold"
        >
          {t('strength.check', { min: Math.round(checkMinutes) })}
        </button>
      )}
    </div>
  )
}
