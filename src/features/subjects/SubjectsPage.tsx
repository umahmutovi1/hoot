import { useTranslation } from 'react-i18next'
import { EmptyCard } from '@/components/EmptyCard'
import { PageTitle } from '@/components/PageTitle'

export function SubjectsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('subjects.title')}</PageTitle>
      <EmptyCard>{t('subjects.empty')}</EmptyCard>
    </div>
  )
}
