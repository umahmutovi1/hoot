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
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        cn(
          'flex h-12 w-[60px] items-center justify-center rounded-full transition-colors',
          isActive ? 'bg-brand-soft text-brand' : 'text-ink-muted',
        )
      }
    >
      <Icon size={22} />
    </NavLink>
  )
}

/**
 * Floating navigation: a frosted pill with the four tabs and the timer button in the middle as a
 * brand-colored circle, so starting a session stays the most prominent action.
 */
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
      className="pointer-events-none fixed inset-x-0 bottom-[calc(14px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/70 bg-surface/70 p-1.5 shadow-[0_8px_28px_rgba(29,26,43,0.14)] backdrop-blur-xl">
        {left.map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}
        <button
          type="button"
          aria-label={t('nav.startSession')}
          title={t('nav.startSession')}
          onClick={() => navigate('/session/start')}
          className="mx-1 flex size-[52px] shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-[0_4px_14px_rgba(75,59,143,0.35)]"
        >
          <TimerIcon size={24} />
        </button>
        {right.map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}
      </div>
    </nav>
  )
}
