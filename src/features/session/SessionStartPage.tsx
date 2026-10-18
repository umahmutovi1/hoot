import { useTranslation } from 'react-i18next'
import { BackHeader } from '@/components/BackHeader'
import { EmptyCard } from '@/components/EmptyCard'

export function SessionStartPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <BackHeader title={t('session.title')} />
      <EmptyCard title={t('app.comingSoon')}>{t('session.empty')}</EmptyCard>
    </div>
  )
}
