import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CapIcon, ClockIcon } from '@/components/icons'
import { PageTitle } from '@/components/PageTitle'
import { CalendarView } from './CalendarView'

/** Plan: Raspored and Dostupnost in the header, and one calendar (Dan / Mjesec). */
export function PlanPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        actions={
          <>
            <Link
              to="/plan/timetable"
              className="flex h-11 items-center gap-1.5 rounded-full glass px-3.5 text-sm font-semibold"
            >
              <CapIcon size={18} className="text-brand" />
              {t('plan.timetableButton')}
            </Link>
            <Link
              to="/plan/availability"
              className="flex h-11 items-center gap-1.5 rounded-full glass px-3.5 text-sm font-semibold"
            >
              <ClockIcon size={18} className="text-brand" />
              {t('availability.title')}
            </Link>
          </>
        }
      >
        {t('plan.title')}
      </PageTitle>
      <CalendarView />
    </div>
  )
}
