import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmptyCard } from '@/components/EmptyCard'
import { GearIcon } from '@/components/icons'
import { PageTitle } from '@/components/PageTitle'

export function ProgressPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        action={
          <Link
            to="/settings"
            aria-label={t('progress.settings')}
            className="flex size-11 items-center justify-center rounded-full bg-surface text-ink"
          >
            <GearIcon size={20} />
          </Link>
        }
      >
        {t('progress.title')}
      </PageTitle>
      <EmptyCard>{t('progress.empty')}</EmptyCard>
    </div>
  )
}
