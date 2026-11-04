import { ActiveInputs } from '@/features/strategist/ActiveInputs'
import { InsightsPanel } from '@/features/strategist/InsightsPanel'
import { StrategistCard } from '@/features/strategist/StrategistCard'
import { ReadinessCard } from './ReadinessCard'
import { SlotCards } from './SlotCards'
import { ProgressProvider, useProgress } from './useProgress'
import { RhythmCard } from './RhythmCard'
import { lazy, Suspense, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ForecastCard } from './ForecastCard'
import { ProgressBreakdown } from './ProgressBreakdown'
import { SlotMap } from './SlotMap'
import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/PageTitle'
import { SessionsCard } from '@/features/session/SessionsCard'
import { EnergyInsight } from './EnergyInsight'
import { GradesOverview } from './GradesOverview'

const Statistics = lazy(() => import('./Statistics').then((m) => ({ default: m.Statistics })))

/** The plan's inputs are many queries; when one failed, the screen would wait for them forever. */
function usePlanLoadFailed() {
  const queryClient = useQueryClient()
  const cache = queryClient.getQueryCache()
  const failed = useSyncExternalStore(
    (notify) => cache.subscribe(notify),
    () => cache.findAll({ predicate: (q) => q.state.status === 'error' }).length > 0,
  )
  return {
    failed,
    retry: () => void queryClient.refetchQueries({ predicate: (q) => q.state.status === 'error' }),
  }
}

function ProgressBody() {
  const { t } = useTranslation()
  const data = useProgress()
  const { failed, retry } = usePlanLoadFailed()
  if (!data && failed)
    return (
      <div className="flex flex-col gap-4">
        <PageTitle>{t('progress.title')}</PageTitle>
        <p role="alert" className="text-sm text-ink-secondary">
          {t('progress.statistics.error')}
        </p>
        <button type="button" className="min-h-11 text-brand" onClick={retry}>
          {t('progress.statistics.retry')}
        </button>
      </div>
    )
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('progress.title')}</PageTitle>
      <Suspense
        fallback={<p className="text-sm text-ink-muted">{t('progress.statistics.loading')}</p>}
      >
        <Statistics />
      </Suspense>
      <ForecastCard />
      <ReadinessCard />
      <ProgressBreakdown />
      <SlotMap />
      <SlotCards />
      <RhythmCard />
      <SessionsCard />
      <GradesOverview />
      <StrategistCard />
      <InsightsPanel />
      <ActiveInputs />
      <EnergyInsight />
    </div>
  )
}

export function ProgressPage() {
  return (
    <ProgressProvider>
      <ProgressBody />
    </ProgressProvider>
  )
}
