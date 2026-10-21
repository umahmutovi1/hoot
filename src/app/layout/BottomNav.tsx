import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ComponentType } from 'react'
import { AiSparkIcon, BookIcon, CalendarIcon, ChartIcon, HomeIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

type Tab = {
  to: string
  label: string
  Icon: ComponentType<{ size?: number }>
  end?: boolean
  ai?: boolean
  ariaLabel?: string
}

function TabLink({ to, label, Icon, end, ai, ariaLabel }: Tab) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={ariaLabel}
      className={({ isActive }) =>
        cn(
          'flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[26px] text-[10px] transition-colors',
          ai
            ? 'font-semibold text-brand-accent'
            : isActive
              ? 'bg-white/70 font-semibold text-brand shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),inset_0_0_0_0.5px_rgba(255,255,255,0.6)]'
              : 'font-medium text-ink-secondary',
        )
      }
    >
      <Icon size={ai ? 23 : 22} />
      {label}
    </NavLink>
  )
}

/**
 * Floating glass capsule with five places (docs/design/README.md → Navigacija). The assistant sits
 * in the middle as a plain accent-colored spark; sessions start from the "Sljedeće" card on Today.
 */
export function BottomNav() {
  const { t } = useTranslation()

  const tabs: Tab[] = [
    { to: '/', label: t('nav.today'), Icon: HomeIcon, end: true },
    { to: '/plan', label: t('nav.plan'), Icon: CalendarIcon },
    { to: '/chat', label: t('nav.ai'), Icon: AiSparkIcon, ai: true, ariaLabel: t('nav.aiLabel') },
    { to: '/subjects', label: t('nav.subjects'), Icon: BookIcon },
    { to: '/progress', label: t('nav.progress'), Icon: ChartIcon },
  ]

  // The fade reaches 96 px below the layout viewport, so Safari's floating toolbar and the
  // keyboard never uncover a hard edge under it.
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 -bottom-24 z-30 h-[calc(226px+env(safe-area-inset-bottom))] bg-gradient-to-b from-mist/0 from-0% via-mist/85 via-[57%] to-mist/85"
      />
      <nav
        aria-label={t('nav.label')}
        className="pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 flex justify-center px-[18px]"
      >
        <div className="glass-strong pointer-events-auto flex h-16 w-full max-w-[394px] items-center rounded-[32px] p-1.5">
          {tabs.map((tab) => (
            <TabLink key={tab.to} {...tab} />
          ))}
        </div>
      </nav>
    </>
  )
}
