import { useTranslation } from 'react-i18next'
import { usePlanStore } from '@/features/plan/store'

/**
 * What a low / high day means for this user, learned from those days (`energyFactors()`). Shown
 * once there is at least one measured day; the plan uses the same numbers.
 */
export function EnergyInsight() {
  const { t } = useTranslation()
  const energy = usePlanStore((s) => s.model?.built.energy)
  if (!energy || (energy.lowDays === 0 && energy.highDays === 0)) return null
  const pct = (x: number) => Math.round(x * 100)
  return (
    <section className="glass flex flex-col gap-1.5 rounded-card p-4">
      <h2 className="text-[15px] font-semibold">{t('progress.energy.title')}</h2>
      {energy.lowDays > 0 && (
        <p className="text-sm text-ink-secondary">
          {t('progress.energy.low', { pct: pct(energy.low), count: energy.lowDays })}
        </p>
      )}
      {energy.highDays > 0 && (
        <p className="text-sm text-ink-secondary">
          {t('progress.energy.high', { pct: pct(energy.high), count: energy.highDays })}
        </p>
      )}
    </section>
  )
}
