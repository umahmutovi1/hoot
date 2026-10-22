import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CapIcon, ClockIcon } from '@/components/icons'
import { PageTitle } from '@/components/PageTitle'
import { cn } from '@/lib/utils'
import { CalendarView } from './CalendarView'
import { ScheduleView } from './ScheduleView'

export function PlanPage({ tab }: { tab: 'calendar' | 'schedule' }) {
  const { t } = useTranslation()
  const tabs = [
    { to: '/plan', label: t('plan.tabCalendar'), id: 'calendar' },
    { to: '/plan/schedule', label: t('plan.tabSchedule'), id: 'schedule' },
  ] as const

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
      <div role="tablist" className="flex rounded-[22px] bg-brand-soft p-1">
        {tabs.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            end
            role="tab"
            aria-selected={tab === item.id}
            className={cn(
              'flex h-10 flex-1 items-center justify-center rounded-[18px] text-sm font-semibold',
              tab === item.id
                ? 'bg-white/85 text-ink shadow-[0_2px_8px_rgba(58,51,96,0.1)]'
                : 'text-ink-secondary',
            )}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      {tab === 'calendar' ? <CalendarView /> : <ScheduleView />}
    </div>
  )
}
