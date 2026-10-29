import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/PageTitle'
import { GoogleSyncBadge } from '@/features/calendars/GoogleSyncBadge'
import { CalendarView } from './CalendarView'

/**
 * Plan: one calendar (Dan / Mjesec) and whether it is in Google Calendar. Dostupnost and Raspored moved into "Uredi dan" on the day
 * view (decision, October 2026), where it is clear they edit the day.
 */
export function PlanPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <PageTitle tag={<GoogleSyncBadge />}>{t('plan.title')}</PageTitle>
      <CalendarView />
    </div>
  )
}
