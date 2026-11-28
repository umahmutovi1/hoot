import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronRightIcon } from '@/components/icons'
import { ReadinessCard } from '@/features/progress/ReadinessCard'
import { ProgressProvider, useProgress } from '@/features/progress/useProgress'

/**
 * "Napredak" on Danas (ROADMAP Sprint 17: the forecast as a range and a chance on Danas): one
 * card with the nearest exam's forecast and "Sedmica u retrovizoru" as rows, the same heading as
 * Raspored and Ispiti, and the readiness question the day before an exam under it.
 */
export function TodayProgress() {
  return (
    <ProgressProvider>
      <ProgressRows />
      <div className="mt-3 empty:hidden">
        <ReadinessCard />
      </div>
    </ProgressProvider>
  )
}

function ProgressRows() {
  const { t } = useTranslation()
  const data = useProgress()
  const forecast = data?.forecasts.find((f) => f.goal.unitIds.length > 0)
  const row = 'flex min-h-14 items-center gap-3 px-4 py-3'
  return (
    <>
      <div className="mx-1.5 mt-[26px] mb-2.5 flex items-baseline justify-between">
        <h2 className="text-xl font-bold tracking-[-0.4px]">{t('today.progress.title')}</h2>
        <Link to="/progress" className="py-2.5 text-[15px] text-brand">
          {t('today.examsAll')}
        </Link>
      </div>
      <div className="surface flex flex-col divide-y divide-hairline overflow-hidden rounded-card">
        {forecast && (
          <Link to="/progress" className={row}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-ink-secondary">
                {t('progress.forecast.title')} · {forecast.subject.name}, {forecast.exam.title}
              </span>
              <span className="text-[17px] font-bold text-brand-strong tabular-nums">
                {rangeText(t, forecast.coverage.p10, forecast.coverage.p90)}
              </span>
              <span className="text-[13px] text-ink-secondary tabular-nums">
                {t('progress.forecast.chance', { pct: Math.round(forecast.pRequired * 100) })}
              </span>
            </span>
            <ChevronRightIcon size={18} className="shrink-0 text-ink-muted" />
          </Link>
        )}
        <Link to="/progress/week" className={row}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t('checkin.title')}</span>
            <span className="text-[13px] text-ink-secondary">{t('checkin.duration')}</span>
          </span>
          <ChevronRightIcon size={18} className="shrink-0 text-ink-muted" />
        </Link>
      </div>
    </>
  )
}

/** "62–100 % gradiva do ispita"; one number when the range has collapsed ("oko 23 %"). */
function rangeText(t: TFunction, p10: number, p90: number): string {
  const low = Math.round(p10 * 100)
  const high = Math.round(p90 * 100)
  return low === high
    ? t('today.progress.rangeOne', { pct: low })
    : t('today.progress.range', { low, high })
}
