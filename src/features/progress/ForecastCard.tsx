import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useProgress } from './useProgress'

export function ForecastCard({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const data = useProgress()
  if (!data || !data.forecasts.length) return null
  const rows = compact ? data.forecasts.slice(0, 1) : data.forecasts
  return (
    <section className="surface flex flex-col gap-3 rounded-card p-4">
      <h2 className="text-base font-semibold">{t('progress.forecast.title')}</h2>
      {rows.map((f) => (
        <Link
          key={f.goalId}
          to={`/subjects/${f.subject.id}`}
          className="flex min-h-11 flex-col gap-1"
        >
          <span className="text-sm font-semibold">
            {f.subject.name} · {f.exam.title}
          </span>
          {f.goal.unitIds.length ? (
            <>
              <span className="text-[15px] font-semibold text-brand">
                {t('progress.forecast.range', {
                  low: Math.round(f.coverage.p10 * 100),
                  high: Math.round(f.coverage.p90 * 100),
                })}
              </span>
              <span className="text-xs text-ink-secondary">
                {t('progress.forecast.chance', { pct: Math.round(f.pRequired * 100) })}
              </span>
              {f.grade && f.hasMemory ? (
                <span className="text-xs text-ink-secondary">
                  {t('progress.forecast.grade', f.grade)}
                </span>
              ) : (
                <span className="text-xs text-ink-muted">{t('progress.forecast.noMemory')}</span>
              )}
            </>
          ) : (
            <span className="text-xs text-ink-muted">{t('progress.forecast.noScope')}</span>
          )}
        </Link>
      ))}
      <p className="text-xs text-ink-muted">{t('progress.forecast.hint')}</p>
    </section>
  )
}
