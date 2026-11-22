import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRightIcon, SparkleIcon } from '@/components/icons'
import { useSetSummaryStudy } from '@/features/plan/useSummaryOffer'
import { summaryMinutes } from '@/lib/estimates/summary'
import { formatDuration } from './format'
import type { Unit } from './model'
import { useSummaryInputs, useUnitSummary, useUnitsWithText } from './summaryApi'

const row =
  'flex min-h-14 w-full items-center gap-3 py-2 pr-3 pl-4 text-left text-ink [&+&]:border-t [&+&]:border-hairline'

/**
 * "Iz teksta izvora" on a Jedinica: Sažetak and Kartice iz gradiva (Sprint 18), shown when the
 * unit (or one of its sub-units) has source text or notes. A unit the plan studies through its
 * summary says so, with "Pročitaj cijelo" to plan the reading again.
 */
export function UnitStudyRows({
  unit,
  subUnitIds,
  base,
  readingMinutes,
}: {
  unit: Unit
  subUnitIds: string[]
  /** `/subjects/:id/sources/:sourceId/units/:unitId` */
  base: string
  readingMinutes: number | undefined
}) {
  const { t } = useTranslation()
  const withText = useUnitsWithText().data
  const summary = useUnitSummary(unit.id, 'unit').data
  const pace = useSummaryInputs().data?.pace ?? { rate: null, samples: 0 }
  const setStudy = useSetSummaryStudy()
  const hasText = [unit.id, ...subUnitIds].some((id) => withText?.has(id))
  if (unit.kind === 'question' || (!hasText && !unit.notes?.trim())) return null
  const summarySub =
    summary && readingMinutes !== undefined
      ? t('summary.unitRows.summaryMade', {
          time: formatDuration(t, summaryMinutes(readingMinutes, summary.words, pace)),
          reading: formatDuration(t, readingMinutes),
        })
      : t('summary.unitRows.summarySub')

  return (
    <section className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{t('summary.unitRows.title')}</span>
      {unit.use_summary && unit.level === 0 && (
        <div className="flex items-center justify-between gap-3 rounded-[20px] bg-subject-lavender-soft py-2 pr-2 pl-4 text-subject-lavender-ink">
          <span className="text-sm font-semibold">{t('summary.planned')}</span>
          <button
            type="button"
            onClick={() => setStudy.mutate({ unitIds: [unit.id], use: false })}
            className="h-11 shrink-0 rounded-[14px] bg-raised/70 px-3.5 text-sm font-bold"
          >
            {t('summary.readFull')}
          </button>
        </div>
      )}
      <div className="surface overflow-hidden rounded-card">
        {hasText && (
          <Link to={`${base}/summary`} className={row}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-subject-lavender-soft text-subject-lavender-ink">
              <SparkleIcon size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-bold">{t('summary.unitRows.summary')}</span>
              <span className="text-[13px] text-ink-secondary tabular-nums">{summarySub}</span>
            </span>
            <ChevronRightIcon size={20} className="text-ink-muted" />
          </Link>
        )}
        <Link to={`${base}/cards`} className={row}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-subject-blue-soft text-brand-strong">
            <SparkleIcon size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{t('summary.unitRows.cards')}</span>
            <span className="text-[13px] text-ink-secondary">{t('summary.unitRows.cardsSub')}</span>
          </span>
          <ChevronRightIcon size={20} className="text-ink-muted" />
        </Link>
      </div>
    </section>
  )
}
