import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { GearIcon } from '@/components/icons'
import { PageTitle } from '@/components/PageTitle'
import { SessionsCard } from '@/features/session/SessionsCard'
import { GradesOverview } from './GradesOverview'

export function ProgressPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        actions={
          <Link
            to="/settings"
            aria-label={t('settings.open')}
            className="glass flex size-11 items-center justify-center rounded-full"
          >
            <GearIcon size={20} />
          </Link>
        }
      >
        {t('progress.title')}
      </PageTitle>
      <SessionsCard />
      <GradesOverview />
    </div>
  )
}
