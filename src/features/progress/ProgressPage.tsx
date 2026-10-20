import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/PageTitle'
import { GradesOverview } from './GradesOverview'

export function ProgressPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('progress.title')}</PageTitle>
      <GradesOverview />
    </div>
  )
}
