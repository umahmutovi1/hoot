import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ComponentType } from 'react'
import { BookIcon, CalendarIcon, ChartIcon, HomeIcon, TimerIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

type Tab = { to: string; label: string; Icon: ComponentType<{ size?: number }>; end?: boolean }

function TabLink({ to, label, Icon, end }: Tab) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-w-14 flex-col items-center gap-1 text-xs',
          isActive ? 'font-semibold text-brand' : 'text-ink-subtle',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-[30px] w-12 items-center justify-center rounded-full',
              isActive && 'bg-brand-soft',
            )}
          >
            <Icon size={22} />
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}

export function BottomNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const left: Tab[] = [
    { to: '/', label: t('nav.today'), Icon: HomeIcon, end: true },
    { to: '/plan', label: t('nav.plan'), Icon: CalendarIcon },
  ]
  const right: Tab[] = [
    { to: '/subjects', label: t('nav.subjects'), Icon: BookIcon },
    { to: '/progress', label: t('nav.progress'), Icon: ChartIcon },
  ]

  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px]"
    >
      <div className="relative h-[104px]">
        {/* White bar with a rounded top and a notch for the floating timer button */}
        <svg
          viewBox="0 0 390 104"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 size-full drop-shadow-[0_-4px_16px_rgba(75,59,143,0.12)]"
        >
          <path
            d="M0 40 Q0 12 28 12 H124 C148 12 150 56 195 56 C240 56 242 12 266 12 H362 Q390 12 390 40 V104 H0 Z"
            className="fill-surface"
          />
        </svg>
        <button
          type="button"
          aria-label={t('nav.startSession')}
          onClick={() => navigate('/session/start')}
          className="absolute -top-[22px] left-1/2 flex size-[68px] -translate-x-1/2 items-center justify-center rounded-full bg-brand-accent text-white"
        >
          <TimerIcon size={26} />
        </button>
        <div className="absolute top-[30px] left-2 flex w-[37%] justify-around">
          {left.map((tab) => (
            <TabLink key={tab.to} {...tab} />
          ))}
        </div>
        <div className="absolute top-[30px] right-2 flex w-[37%] justify-around">
          {right.map((tab) => (
            <TabLink key={tab.to} {...tab} />
          ))}
        </div>
      </div>
      <div className="h-[env(safe-area-inset-bottom)] bg-surface" />
    </nav>
  )
}
