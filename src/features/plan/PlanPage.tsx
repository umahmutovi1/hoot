import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClockIcon } from '@/components/icons'
import { Mascot } from '@/components/Mascot'
import { PageTitle } from '@/components/PageTitle'
import { cn } from '@/lib/utils'
import { CalendarView } from './CalendarView'

export function PlanPage({ tab }: { tab: 'calendar' | 'schedule' }) {
  const { t } = useTranslation()
  const tabs = [
    { to: '/plan', label: t('plan.tabCalendar'), id: 'calendar' },
    { to: '/plan/schedule', label: t('plan.tabSchedule'), id: 'schedule' },
  ] as const

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        action={
          <Link
            to="/plan/availability"
            className="flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold"
          >
            <ClockIcon size={18} className="text-brand" />
            {t('availability.title')}
          </Link>
        }
      >
        {t('plan.title')}
      </PageTitle>
      <div role="tablist" className="flex rounded-[22px] bg-track p-1">
        {tabs.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            end
            role="tab"
            aria-selected={tab === item.id}
            className={cn(
              'flex h-10 flex-1 items-center justify-center rounded-[18px] text-sm font-semibold',
              tab === item.id ? 'bg-surface text-ink' : 'text-ink-muted',
            )}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      {tab === 'calendar' ? (
        <CalendarView />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-card-lg bg-surface p-6 text-center">
          <Mascot pose="timer-head" size={96} />
          <p className="text-sm leading-snug text-ink-muted">{t('plan.scheduleEmpty')}</p>
        </div>
      )}
    </div>
  )
}
