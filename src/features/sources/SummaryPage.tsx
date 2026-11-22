import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { SummaryScope } from '@shared/schemas.ts'
import { RefreshIcon } from '@/components/icons'
import { ScreenTitle } from '@/components/ScreenTitle'
import { DetailSkeleton } from '@/components/Skeleton'
import { useRates } from '@/features/plan/api'
import { summaryMinutes } from '@/lib/estimates/summary'
import { cn } from '@/lib/utils'
import { useSource } from './api'
import { pagesLabel } from './format'
import { materialOf, measureOf } from './model'
import { useMakeSummary, useSummaryInputs, useUnitSummary } from './summaryApi'
import { MakeSummary, SummaryView } from './SummaryView'

/**
 * Sažetak (board "Jedinica · sažetak"): the summary of a unit or of its whole chapter from the
 * source text, made on tap and kept while the text is the same. Below: tutor, cards, check.
 */
export function SummaryPage() {
  const { id, sourceId, unitId } = useParams()
  const { data: source, isPending } = useSource(id, sourceId)
  const { t } = useTranslation()
  const rates = useRates()
  const unit = source?.units.find((u) => u.id === unitId)
  const [scope, setScope] = useState<SummaryScope>('unit')
  const summary = useUnitSummary(unitId ?? '', scope)
  const inputs = useSummaryInputs().data
  const refresh = useMakeSummary()
  if (isPending) return <DetailSkeleton />
  if (!source || !unit) return <Navigate to={`/subjects/${id}`} replace />

  const base = `/subjects/${id}/sources/${source.id}/units/${unit.id}`
  const material = materialOf(source, rates.get(source.id))
  const reading = material.units.find((u) => u.id === unit.id)?.minutes
  const studyMinutes =
    summary.data && reading !== undefined
      ? summaryMinutes(reading, summary.data.words, inputs?.pace ?? { rate: null, samples: 0 })
      : undefined
  const sub = [unit.title, pagesLabel(t, measureOf(source), unit)].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle
        title={t('summary.title')}
        sub={sub}
        actions={
          summary.data && (
            <button
              type="button"
              aria-label={t('summary.refresh')}
              disabled={refresh.isPending}
              onClick={() => refresh.mutate({ unitId: unit.id, scope, refresh: true })}
              className={cn(
                'flex size-11 items-center justify-center',
                refresh.isPending && 'animate-spin motion-reduce:animate-none',
              )}
            >
              <RefreshIcon size={22} />
            </button>
          )
        }
      />
      {unit.parent_id && (
        <div className="flex justify-center">
          <div
            role="radiogroup"
            aria-label={t('summary.scope')}
            className="inline-flex h-11 gap-1 rounded-full surface p-1"
          >
            {(['unit', 'chapter'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={scope === s}
                onClick={() => setScope(s)}
                className={cn(
                  'h-9 rounded-full px-4 text-sm font-bold',
                  scope === s ? 'bg-raised text-ink shadow-sm' : 'text-ink-secondary',
                )}
              >
                {t(`summary.scopes.${s}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {summary.isPending ? (
        <DetailSkeleton />
      ) : summary.data ? (
        <>
          <SummaryView summary={summary.data} minutes={studyMinutes} readingMinutes={reading} />
          <p className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
            {t('summary.notReplacing')}
          </p>
          <div className="flex flex-col gap-2">
            <Link
              to={`${base}/cards`}
              className="flex h-[52px] items-center justify-center rounded-[16px] bg-subject-blue-soft text-[15px] font-bold text-brand-strong"
            >
              {t('summary.toCards')}
            </Link>
            <Link
              to={`/session/recall?units=${unit.id}&to=${encodeURIComponent(base)}`}
              className="flex h-12 items-center justify-center text-[15px] font-bold text-brand-strong"
            >
              {t('summary.check')}
            </Link>
          </div>
        </>
      ) : (
        <MakeSummary unitId={unit.id} scope={scope} />
      )}
    </div>
  )
}
