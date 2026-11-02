import { ActiveInputs } from '@/features/strategist/ActiveInputs'
import { InsightsPanel } from '@/features/strategist/InsightsPanel'
import { StrategistCard } from '@/features/strategist/StrategistCard'
import { ReadinessCard } from './ReadinessCard'
import { SlotCards } from './SlotCards'
import { ProgressProvider } from './useProgress'
import { RhythmCard } from './RhythmCard'
import { lazy, Suspense } from 'react'
import { ForecastCard } from './ForecastCard'
import { ProgressBreakdown } from './ProgressBreakdown'
import { SlotMap } from './SlotMap'
import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/PageTitle'
import { SessionsCard } from '@/features/session/SessionsCard'
import { EnergyInsight } from './EnergyInsight'
import { GradesOverview } from './GradesOverview'

const Statistics = lazy(() => import('./Statistics').then((m) => ({ default: m.Statistics })))

export function ProgressPage() {
  const { t } = useTranslation()
  return (
    <ProgressProvider>
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
    </ProgressProvider>
  )
}
